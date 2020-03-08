const mongoose = require("mongoose");
const router = require("express").Router();
const uniqid = require("uniqid");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = mongoose.model("Users");
const Issue = mongoose.model("Issues");
const cloudinary = require("cloudinary");
const { Expo } = require("expo-server-sdk");
const formidable = require("formidable"),
  fs = require("fs"),
  path = require("path"),
  moment = require("moment");

// Create a new Expo SDK client
let expo = new Expo();
//cloudinary config
cloudinary.config({
  cloud_name: "dfvyoh7qx",
  api_key: 571435583928238,
  api_secret: "stZi7uFlmw3qIMr6LTBQbntCwMA"
});

router.post(
  "/upload",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    // console.log("Hey")
    const { user } = req;
    const options = {
      multiples: true,
      maxFileSize: 1024 * 1024 * 100
    };

    const form = formidable(options);
    //console.log(req.user)
    new Promise((resolve, reject) => {
      form.parse(req);
      let issueDetails = {};
      let images = [];
      form.on("error", err => {
        console.log(err.message);
        return res
          .status(200)
          .json({ message: "An error occured in processing your request" });
      });
      form.on("fileBegin", (filename, file) => {
        // let img = uniqid("image_") + path.extname(file.name);
        // file.path = path.join(__dirname + "/../../public/uploads/") + img;
        images.push(file);
      });
      form.on("field", (field, name) => {
        // console.log(JSON.parse(name));
        issueDetails = { ...JSON.parse(name) };
        return resolve({
          issueDetails: { ...issueDetails, images: [] },
          images
        });
      });
    }).then(async data => {
      new Promise((resolve, reject) => {
        data.images.map(async eachImage => {
          cloudinary.v2.uploader
            .upload(eachImage.path)
            .then(result => {
              fs.unlinkSync(eachImage.path);
              if (data.images.length - 1 === data.issueDetails.images.length) {
                data.issueDetails.images.push(result.secure_url);
                return resolve(data.issueDetails);
              } else {
                data.issueDetails.images.push(result.secure_url);
              }
            })
            .catch(err => {
              console.log(err);
              reject(err);
            });
        });
      }).then(data => {
        console.log("[data]", data);

        let type = null;
        switch (data.issueType) {
          case "Water  and sanitation":
            type = "WS/";
            break;
          case "Road and transport":
            type = "RT/";
            break;
          case "Housing and land":
            type = "HL/";
            break;
          case "Agriculture and livestock":
            type = "AL/";
            break;
          case "other":
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
          uniqid.time();
        new Issue({
          reportId,
          county: data.locationInfo.address.region,
          sub_county: data.sub_county,
          type: data.issueType,
          locationInfo: data.locationInfo,
          description: data.description,
          images: data.images,
          userId: user._id
        })
          .save()
          .then(newIssue => {
            //console.log(newIssue);
            res.status(200).json({ success: true, issue: newIssue });
          })
          .catch(err => {
            reject(err);
          });
      });
    });
  }
);
router.post("/all", (req, res, next) => {
  const { body } = req;
  //console.log("[body of all ]", body);
  let search = {};
  let filter = {};
  let sort = { createdAt: -1 };
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
          $in: values
        };
      }
      or.push({ [field]: values });
    }
  }

  if (or.length > 0) {
    filter = {
      $or: or
    };
  }
  // console.log("[filter]", filter);
  //Searching
  if (body.query) {
    body.query = kebab(body.query);
    ft = {
      $or: [
        { type: { $regex: body.query, $options: "i" } },
        { county: { $regex: body.query, $options: "i" } },

        { sub_county: { $regex: body.query, $options: "i" } }
      ]
    };
  }
  let aggregate = Issue.aggregate()
    .match({
      $and: [search, filter]
    })
    .sort(sort);
  Issue.aggregatePaginate(aggregate, {
    page: body.page,
    limit: body.limit
  }).then(results => {
    const data = [...results.docs];
    results.docs = data.length;
    res.json({ success: true, issues: data, meta: results });
  });
});
const sendNotification = messages => {
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
kebab = string => {
  if (string) {
    string = string
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  return string;
};
module.exports = router;
