const mongoose = require("mongoose");
const router = require("express").Router();
const uniqid = require("uniqid");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = mongoose.model("Users");
const Notification = mongoose.model("Notifications");
const Issue = mongoose.model("Issues");
const County = mongoose.model("Counties");
const imagemin = require("imagemin");
const imageminJpegtran = require("imagemin-jpegtran");
const imageminPngquant = require("imagemin-pngquant");
const cloudinary = require("cloudinary");
const { Expo } = require("expo-server-sdk");

const formidable = require("formidable"),
  fs = require("fs"),
  path = require("path"),
  moment = require("moment");
request = require("request");
rp = require("request-promise");
// Create a new Expo SDK client
let expo = new Expo();
//cloudinary config
cloudinary.config({
  cloud_name: "dfvyoh7qx",
  api_key: 571435583928238,
  api_secret: "stZi7uFlmw3qIMr6LTBQbntCwMA",
});

router.post(
  "/upload",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    // console.log("Hey")
    const { user } = req;
    const options = {
      multiples: true,
      maxFileSize: 1024 * 1024 * 10,
    };

    const form = formidable(options);
    //console.log(req.user)
    new Promise(async (resolve, reject) => {
      form.parse(req);
      let issueDetails = {};
      let images = [];
      form.on("error", (err) => {
        console.log(err.message);
        return res.status(200).json({ message: err.message });
      });
      form.on("fileBegin", (filename, file) => {
        // let img = uniqid() + path.extname(file.name);
        // file.path = path.join(__dirname + "../../../cimages/") + img;
        images.push(file);
      });
      form.on("field", (field, name) => {
        // console.log(JSON.parse(name));
        issueDetails = { ...JSON.parse(name) };
        return resolve({
          issueDetails: { ...issueDetails, images: [] },
          images,
        });
      });
    })
      .then(async (data) => {
        // console.log(data.images);
        let paths = data.images.map((e) => e.path);
        console.log(paths);
        const files = await imagemin(paths, {
          destination: "../../../cimages/optimized/",
          plugins: [
            imageminJpegtran(),
            imageminPngquant({
              quality: [0.6, 0.8],
            }),
          ],
        });

        console.log("[Optimized]", files);
        return;

        new Promise((resolve, reject) => {
          data.images.map(async (eachImage) => {
            cloudinary.v2.uploader
              .upload(eachImage.path)
              .then((result) => {
                fs.unlinkSync(eachImage.path);
                if (
                  data.images.length - 1 ===
                  data.issueDetails.images.length
                ) {
                  data.issueDetails.images.push(result.secure_url);
                  return resolve(data.issueDetails);
                } else {
                  data.issueDetails.images.push(result.secure_url);
                }
              })
              .catch((err) => {
                console.log(err);
                res.json({ success: false, message: err.message });
              });
          });
        }).then((data) => {
          console.log("[data]", data);

          let type = null;
          switch (data.issueType) {
            case "Water and sanitation":
              type = "WS/";
              break;
            case "Roads and transport":
              type = "RT/";
              break;
            case "Housing and land":
              type = "HL/";
              break;
            case "Agriculture and livestock":
              type = "AL/";
              break;
            case "Health Services and Public Health":
              type = "HH";
            default:
              type = "O/";
              break;
          }

          let reportId =
            "RP/" +
            type +
            moment(new Date()).format("YYYY") +
            "/" +
            moment(new Date()).format("MM") +
            "/" +
            uniqid.time().toUpperCase();
          new Issue({
            reportId,
            county: data.locationInfo.address.region,
            sub_county: data.sub_county,
            type: data.issueType,
            notify: data.notify,
            locationInfo: data.locationInfo,
            description: data.description,
            proposedSolution: data.proposedSolution,
            images: data.images,
            userId: user._id,
          })
            .save()
            .then(async (newIssue) => {
              //console.log(newIssue);
              await Notification.create({
                title: `${req.user.fname} has just reported a  new issue.`,
                type: "new-report",
                body: newIssue.description,
                doc: newIssue,
                createdAt: new Date(),
                channel: "io",
                to: "admin",
                initiator: req.user._id,
              });
              req.io.to("admin").emit("notification2", {
                title: `${req.user.fname} has just reported a  new issue.`,
                description: newIssue.description,
                type: "new-report",
                createdAt: new Date(),
              });
              res.status(200).json({ success: true, issue: newIssue });
            })
            .catch((err) => {
              res.json({ success: false, message: err.message });
            });
        });
      })
      .catch((err) => {
        res.json({ success: false, message: err.message });
      });
  }
);
//Fetch all issues
router.post(
  "/all",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    console.log("[body of all ]", body);
    let search = {};
    let filter = {};
    let adminFilter = {};
    let sort = { createdAt: -1 };
    //Filter by admin
    if (req.user.role == "ward-admin") {
      adminFilter = {
        "escalated.to": { $in: [req.user.ward] },
      };
    }

    //Sorting
    if (body.sortField) {
      sort = { [body.sortField]: body.sortOrder == "ascend" ? 1 : -1 };
    }

    //console.log(Object.keys(body));
    //filtering
    let or = [];
    for (let key of Object.keys(body)) {
      if (key.includes("[]")) {
        field = key.substring(0, key.indexOf("["));
        values = body[key];
        if (Array.isArray(values)) {
          values = {
            $in: values,
          };
        }
        or.push({ [field]: values });
      }
    }

    if (or.length > 0) {
      filter = {
        $or: or,
      };
    }
    if (or.length > 1) {
      filter = { $and: or };
      //console.log("[fil]", fil);
      // filter = {
      //   $or:and
      // }
    }
    console.log("[filter]", filter);
    //  if(filter['$or'])
    //Searching
    if (body.query) {
      body.query = kebab(body.query);
      ft = {
        $or: [
          { type: { $regex: body.query, $options: "i" } },
          { county: { $regex: body.query, $options: "i" } },

          { sub_county: { $regex: body.query, $options: "i" } },
        ],
      };
    }
    let aggregate = Issue.aggregate()
      .match({
        $and: [search, filter, adminFilter],
      })
      .sort(sort);
    Issue.aggregatePaginate(aggregate, {
      page: body.page,
      limit: body.limit,
    }).then((results) => {
      const data = [...results.docs];
      results.docs = data.length;
      res.json({ success: true, issues: data, meta: results });
    });
  }
);
//Fetch a single issue
router.post("/single", (req, res, next) => {
  const { body } = req;
  console.log(body);
  Issue.findById(body.record)
    .then(async (issue) => {
      let user = await User.findById(issue.userId);
      issue._doc.reportedBy = parseUser(user._doc);
      return issue;
    })

    .then(async (issue) => {
      //fetch responders
      let responders = issue.response.map((each) => {
        return mongoose.Types.ObjectId(each.by);
      });
      responders = await User.find({ _id: { $in: responders } });
      let newIss = Object.assign({}, issue._doc);

      newIss.response = newIss.response.map((each, i) => {
        let response = Object.assign({}, each._doc);
        //  console.log(response);
        responders.map((user) => {
          let by = parseUser(Object.assign({}, user._doc));
          //console.log(by);
          // if(by._id==each.by)
          each = { ...each._doc, by };
        });
        return each;
      });
      // console.log(newIss);
      //  console.log(issue._doc.reportedBy);
      return { data: newIss, reportedBy: issue._doc.reportedBy };
    })
    .then(async ({ data, reportedBy }) => {
      let county = data.county;
      county = county.slice(0, county.indexOf("County") - 1).replace(" ", "+");
      const options = {
        method: "GET",
        uri: `https://frozen-basin-45055.herokuapp.com/api/wards?county=${county}`,
        json: true,
      };
      let wards = await rp(options)
        .then(function (wards) {
          let sub_county = data.sub_county;
          if (sub_county.indexOf("Sub County") > -1)
            sub_county = sub_county.slice(
              0,
              sub_county.indexOf("Sub County") - 1
            );
          if (sub_county.indexOf(".") > -1)
            sub_county = sub_county.slice(0, sub_county.indexOf("."));
          console.log(wards.length, sub_county);
          return (wards = wards.filter((ward) => {
            // console.log(ward.constituency, "vs", sub_county);
            return ward.constituency == sub_county;
          }));
        })
        .catch(function (err) {
          console.log(err);
          res.json({ success: false, message: err.message });
        });
      request(options, function (error, response) {
        if (error) throw new Error(error);
      });

      res.json({
        success: true,
        data,
        reportedBy,
        wards,
      });
    })
    .catch((err) => {
      console.log(err);
      res.json({ success: false, message: err.message });
    });
});

const sendNotification = (messages) => {
  //   messages.push({
  //     to: "ExponentPushToken[20Op7YOrhkk5t5EKNUO827]",
  //     sound: "default",
  //     body: "Hello again Pharez, Your issue server just woke up !!!",
  //     channelId: "issue-reports"
  //   });
  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  (async () => {
    // Send the chunks to the Expo push notification service. There are
    // different strategies you could use. A simple one is to send one chunk at a
    // time, which nicely spreads the load out over time:
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        //   console.log(ticketChunk);
        tickets.push(...ticketChunk);
        // NOTE: If a ticket contains an error code in ticket.details.error, you
        // must handle it appropriately. The error codes are listed in the Expo
        // documentation:
        // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
      } catch (error) {
        console.error(error);
      }
    }
  })();
  let receiptIds = [];
  for (let ticket of tickets) {
    // NOTE: Not all tickets have IDs; for example, tickets for notifications
    // that could not be enqueued will have error information and no receipt ID.
    if (ticket.id) {
      receiptIds.push(ticket.id);
    }
  }

  let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  (async () => {
    // Like sending notifications, there are different strategies you could use
    // to retrieve batches of receipts from the Expo service.
    for (let chunk of receiptIdChunks) {
      try {
        let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        console.log(receipts);

        // The receipts specify whether Apple or Google successfully received the
        // notification and information about an error, if one occurred.
        for (const receiptId in receipts) {
          const { status, message, details } = receipts[receiptId];
          if (status === "ok") {
            continue;
          } else if (status === "error") {
            console.error(
              `There was an error sending a notification: ${message}`
            );
            if (details && details.error) {
              // The error codes are listed in the Expo documentation:
              // https://docs.expo.io/versions/latest/guides/push-notifications/#individual-errors
              // You must handle the errors appropriately.
              console.error(`The error code is ${details.error}`);
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  })();
};
sendNotification([]);
kebab = (string) => {
  if (string) {
    string = string
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  return string;
};

const parseUser = (user) => {
  if (user.role == "admin") {
    delete user.students;
    delete user.trainers;
    delete user.instructors;
    delete user.courses;
  }
  delete pushToken;
  delete user.password;
  delete user.__v;
  return user;
};
module.exports = router;
const randomLocation = require("random-location");
const faker = require("faker");
(async () => {
  const R = 15000; // meters
  let data = [];

  let counties = await County.find({}, { coords: 1, name: 1 });
  counties.map((each) => {
    for (var i = 0; i < 1; i++) {
      let P = {
        latitude: each.coords.lat,
        longitude: each.coords.lng,
      };
      let randomPoint = randomLocation.randomCirclePoint(
        P,
        R,
        (randomFn = Math.random)
      );
      let issue = {
        images: [
          "https://res.cloudinary.com/dfvyoh7qx/image/upload/v1582555176/m5n4st2i7wrbe6lyxyie.jpg",
          "https://res.cloudinary.com/dfvyoh7qx/image/upload/v1582555176/utfioxwrcqn5g1f2ug67.jpg",
          "https://res.cloudinary.com/dfvyoh7qx/image/upload/v1582555177/gtusiyrrjmsm0mxmuj73.jpg",
        ],
        notify: true,

        reportId: "RP/HL/2020/02/" + uniqid.time().toUpperCase(),
        county: "random",
        status: "pending",
        type: faker.random.arrayElement([
          "Roads and transport",
          "Water  and sanitation",
          "Housing and land",
          "Agriculture and livestock",
          "Health Services and Public Health",
          "other",
        ]),
        locationInfo: {
          coords: {
            altitude: 0,
            heading: 0,
            longitude: randomPoint.longitude,
            speed: 0,
            latitude: randomPoint.latitude,
            accuracy: 33.185001373291016,
          },
          address: {
            postalCode: null,
            country: "random",
            isoCountryCode: "KE",
            name: "random",
            city: "random",
            street: "random",
            region: each.name,
          },
        },
        description: "random",
        userId: "5e3d0603f3b44a2a24820326",
      };
      data.push(issue);
    }
  });
  // Issue.create(data);
  Issue.deleteMany({ description: "random" })
    .then()
    .catch((err) => console.err);
})();
