const mongoose = require("mongoose");
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = mongoose.model("Users");
const Issue = mongoose.model("Issues");
const Notification = mongoose.model("Notifications");
const County = mongoose.model("Counties");
const generator = require("generate-password");
const rp = require("request-promise");
const nodemailer = require("nodemailer");
const { Expo } = require("expo-server-sdk");
let expo = new Expo();

router.post("/login", (req, res, next) => {
  const { body } = req;
  console.log(body);
  let email = body.email;
  let password = body.password;
  let remember = body.remember;
  User.findOne({ email }).then((user) => {
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Incorrect email or --password!",
      });
    }
    if (
      user.role !== "admin" &&
      user.role !== "ward-admin" &&
      user.role !== "sub-county-admin" &&
      user.role !== "department-official"
    ) {
      return res.status(200).json({
        success: false,
        message: "Incorrect email or --password!",
      });
    }
    bcrypt.compare(password, user.password).then((isMatch) => {
      if (isMatch) {
        if (user.status == "pending-approval")
          return res.status(200).json({
            success: false,
            message:
              "Your account is yet to be approved. It might take a while as your info has to be reviewed!",
          });
        if (user.status == "suspended")
          return res
            .status(200)
            .json({ success: false, message: "Your account was suspended!" });
        const payload = parseUser(user._doc);

        jwt.sign(
          payload,
          "secret",
          {
            expiresIn: body.remember ? "365d" : 60 * 30,
          },
          (err, token) => {
            if (err) console.error("There is some error in token", err);
            else {
              res.json({
                success: true,
                token: `Bearer ${token}`,

                message: "You have successfully logged in",
              });
            }
          }
        );
      } else {
        return res
          .status(200)
          .json({ success: false, message: "Incorrect username or password!" });
      }
    });
  });
});

router.post("/register", (req, res, next) => {
  const { body } = req;
  console.log("[register body]", body);

  User.findOne({
    phoneNumber: body.phoneNumber,
  }).then((user) => {
    if (user) {
      return res
        .status(200)
        .json({ success: false, message: "Phone number already in use" });
    } else {
      User.findOne({
        email: body.email,
      }).then((user) => {
        if (user) {
          return res
            .status(200)
            .json({ success: false, message: "Email already in user" });
        } else {
          const newUser = new User({
            phoneNumber: body.phoneNumber,
            email: body.email,
            fname: body.fname,
            lname: body.lname,

            password: body.password,
          });

          bcrypt.genSalt(10, (err, salt) => {
            if (err) console.error("There was an error", err);
            else {
              bcrypt.hash(newUser.password, salt, (err, hash) => {
                if (err) console.error("There was an error", err);
                else {
                  newUser.password = hash;
                  newUser.save().then((user) => {
                    user = user.toObject();
                    delete user.password;
                    const payload = {
                      id: user._id,
                      fname: user.fname,
                      lname: user.lname,

                      email: user.email,
                      isVerified: user.isVerified,
                    };
                    jwt.sign(
                      payload,
                      "secret",
                      {
                        expiresIn: 90000,
                      },
                      (err, token) => {
                        if (err)
                          console.error("There is some error in token", err);
                        else {
                          res.json({
                            success: true,
                            token: `Bearer ${token}`,

                            message: "Registration Successful",
                          });
                        }
                      }
                    );
                  });
                }
              });
            }
          });
        }
      });
    }
  });
});

/**
 *Endpoint for checking token ...*
 **/
router.post(
  "/checkToken",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    console.log("token valid");
    res.json({});
  }
);
/**
 *Endpoint for fetching notifications ...*
 **/
router.post(
  "/notifications",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    const { user } = req;
    Notification.find({ to: user.role })
      .sort({ createdAt: -1 })
      .then((data) => {
        res.json({ success: true, data });
      })
      .catch((err) => {
        console.log(err);
        res.json({ success: false, message: err.message });
      });
  }
);
/**
 *Endpoint for fetching notifications ...*
 **/
router.post(
  "/header_notifications",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    const { user } = req;
    Notification.find({ to: user.role, opened: false })
      .sort({ createdAt: -1 })
      .then((data) => {
        res.json({ success: true, data });
      })
      .catch((err) => {
        console.log(err);
        res.json({ success: false, message: err.message });
      });
  }
);
/**
 *Endpoint for updating  notifications ...*
 **/
router.post(
  "/update_notifications",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    const { user } = req;
    console.log("[body of updatenotifications]", body);
    await Notification.findByIdAndUpdate(body.record, { opened: true });
    let newNotifications = await Notification.find({
      to: user.role,
      opened: false,
    }).sort({ createdAt: -1 });
    //emit new
    // req.io.to("admin").emit("notification2", {
    //   title: `${req.user.fname} has just reported a  new issue.`,
    //   description: newIssue.description,
    //   type: "new-report",
    //   createdAt: new Date(),
    // });
    //   .then(data => {
    //     res.json({ success: true, data });
    //   })
    //   .catch(err => {
    //     console.log(err);
    //     res.json({ success: false, message: err.message });
    //   });
  }
);
/**
 *Endpoint for updating issue ...*
 **/
router.post(
  "/update_issue",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    const { user } = req;
    // console.log(body);
    Issue.findById(body._id)

      .then((issue) => {
        issue.status = body["radio-button"];
        issue.response.push({
          by: req.user._id,
          message: body.message,
          statusTo: body["radio-button"],
          time: new Date(),
        });
        return issue
          .save()
          .then(async (newIssue) => {
            return newIssue;
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
            //  console.log(newIss);
            res.json({ success: true, issue: newIss });
          })
          .catch((err) => {
            console.log(err);
            res.json({ success: false, message: err.message });
          });
        // res.json({ success: true, data });
      })
      .catch((err) => {
        console.log(err);
        res.json({ success: false, message: err.message });
      });
  }
);
/**
 *Endpoint for acting on is issue ...*
 **/
router.post(
  "/issue_action",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    console.log(body);
    try {
      let issue = await Issue.findOne({ _id: body.record });
      // console.log(issue);
      switch (body.action) {
        case "respond":
          console.log("responding");
          //Notify client and add to response array
          issue.status = body["radio-button"];
          issue.response.push({
            by: req.user._id,
            message: body.message,
            statusTo: body["radio-button"],
            time: new Date(),
          });
          break;
        case "escalate":
          //Notify and assign to ward / admnistrator
          issue.status = "escalated";
          issue.response.push({
            by: req.user._id,
            to: body.escalateTo,
            message: body.message,
            statusTo: "escalated",
            time: new Date(),
          });
          console.log(body.escalateTo, "vs", body.escalateTo.substring(0, 2));
          issue.escalated = {
            bool: true,
            to: [body.escalateTo.substring(3, body.escalateTo.length)],
            category:
              body.escalateTo.substring(0, 3) == "(W)"
                ? "ward"
                : body.escalateTo.substring(0, 3) == "(D)"
                ? "department"
                : null,
          };

          break;
        case "close":
          issue.status = "closed";
          issue.response.push({
            by: req.user._id,

            message: body.reason,
            statusTo: "closed",
            time: new Date(),
          });
          issue.closed = {
            by: req.user._id,
            reason: body.reason,
            time: new Date(),
          };
          //Notify user
          break;
      }
      issue = await issue.save();
      console.log("{new issue}", issue);
      /**
       * fetch responders
       *  */
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
      console.log(newIss);
      //Send notification to user
      if (newIss.notify) {
        // {
        //   //     to: "ExponentPushToken[20Op7YOrhkk5t5EKNUO827]",
        //   //     sound: "default",
        //   //     body: "Hello again Pharez, Your issue server just woke up !!!",
        //   //     channelId: "issue-reports"
        //   //   }
        let pT = await User.findOne(
          { _id: newIss.userId },
          { pushToken: 1, fname: 1, lname: 1 }
        );
        if (pT.pushToken) {
          sendNotification([
            {
              to: pT.pushToken,
              sound: "default",
              body: `Hello ${pT.fname.toUpperCase()}, We have responded to the issue you reported. Check Issue Reporting App for update `,
              channelId: "issue-reports",
            },
          ]);
        }
      }
      res.json({
        success: true,
        issue: newIss,
        message: "Issue updated successfully",
      });
    } catch (err) {
      console.log(err);
      res.json({ success: false, message: err.message });
    }
  }
);
/**
 *Endpoint for fetching all users ...*
 **/
router.post(
  "/allUsers",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    console.log("[body of all ]", body);
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
    let aggregate = User.aggregate()
      .match({ $and: [search, filter] })
      .project({
        email: 1,
        phoneNumber: 1,
        role: 1,
        status: 1,
        createdAt: 1,
        name: { $concat: ["$fname", " ", "$lname"] },
      })
      .sort(sort);
    User.aggregatePaginate(aggregate, {
      page: body.page,
      limit: body.limit,
    })
      .then((results) => {
        const data = [...results.docs];
        results.docs = data.length;
        res.json({ success: true, issues: data, meta: results });
      })
      .catch((err) => {
        res.json({ success: false, message: err.message });
      });
  }
);
/**
 *Endpoint for fetching sub counties...*
 **/
router.post(
  "/loadCounties",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    County.find({})
      .then((counties) => {
        // console.log("found", county);

        res.json({
          success: true,
          counties,
        });
      })
      .catch((err) => {
        res.json({
          success: false,
          message: "Failed to get counties!",
        });
      });
  }
);
/**
 *Endpoint for fetching wards...*
 **/
router.post(
  "/loadWards",
  // passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    console.log("[wards body]", body);
    try {
      let county = body.county;
      county = county.replace(" ", "+");
      console.log(county);
      const options = {
        method: "GET",
        uri: `https://frozen-basin-45055.herokuapp.com/api/wards?county=${county}`,
        json: true,
      };
      let wards = await rp(options).then(function (wards) {
        let sub_county = body.sub_county;
        if (sub_county.indexOf("Sub County") > -1)
          sub_county = sub_county.slice(
            0,
            sub_county.indexOf("Sub County") - 1
          );
        if (sub_county.indexOf(".") > -1)
          sub_county = sub_county.slice(0, sub_county.indexOf("."));
        console.log(wards.length, sub_county);
        return (wards = wards.filter((ward) => {
          //    console.log(ward.constituency, "vs", sub_county);
          return ward.constituency == sub_county;
        }));
      });
      res.json({ success: true, wards: wards });
    } catch (err) {
      res.json({ success: false, message: err.message });
    }
  }
);
/**
 *Endpoint for single user...*
 **/
router.post(
  "/single_user",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    console.log(" body]", body);
    try {
      let user = await User.findOne({ _id: body.record }, { password: 0 });

      res.json({ success: true, data: user });
    } catch (err) {
      res.json({ success: false, message: err.message });
    }
  }
);

/**
 *Endpoint for new official..*
 **/
router.post(
  "/new_official",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    console.log(" body]", body);
    try {
      //Check email if in use
      const inUse = await User.findOne({
        email: body.email,
      });
      if (inUse) throw new Error("Email is already in use !");
      //Validate phone number
      if (isNaN(body.phone)) throw new Error("Invalid phone number!");
      const options = {
        method: "GET",
        uri: `http://apilayer.net/api/validate?access_key=756653a2f405c7dd3283ef464aa47eeb&number=${body.phone}&country_code=KE&format=1`,
        json: true,
      };
      let valid = await rp(options);
      console.log(valid);
      if (!valid.valid) if (!valid.success) throw new Error(valid.error.info);
      body.phone = valid.international_format;
      //Generate password
      const password = generator.generate({
        length: 8,
        numbers: true,
      });
      //Salt and hash
      let salt = await bcrypt.genSalt(10);
      let hash = await bcrypt.hash(password, salt);
      // let match = await bcrypt.compare(password, hash);
      // console.log(salt, hash, match);
      //Create new User
      let newUser = {
        fname: body.fname,
        lname: body.lname,
        email: body.email,
        phoneNumber: body.phone,
        role: body.Role,
        county: body.County,
        subCounty: body.subCounty,
        department: body.department,
        password: hash,
      };
      if (body.Role == "ward-admin") newUser.ward = body.ward;
      let createdUser = await User.create(newUser);
      // console.log(createdUser);
      //Send email
      let sent = await mailer({
        from: "Issue Reporting System <issuereport@yandex.com>", // sender address
        to: "kotekunra@gmail.com" + "," + body.email, // list of receivers
        subject: "Login Details ", // Subject line
        text: "Issue Reporting", // plaintext body
        html: `<p>Hello  ${capitalize(
          body.fname
        )} ,</p>  You have been registered to Issue Reporting System  as  a ${capitalize(
          body.Role
        )} <p>Login with the following details:  <p><b>Email</b>: ${
          body.email
        } </p><p> <b>Password</b>: ${password}</p>`,
      });
      //   console.log(sent);
      if (!sent.success) throw new Error(sent.message);
      res.json({ success: true });
    } catch (err) {
      console.log(err);
      if (!err.message.includes("Email"))
        User.deleteOne({ email: body.email }).then().catch();
      res.json({ success: false, message: err.message });
    }
  }
);

/**
 *Endpoint for dashboard data..*
 **/
router.post(
  "/dash_data",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      let reported = await Issue.find().countDocuments();
      let resovled = await Issue.find({
        $or: [{ status: "resolved" }, { status: "closed" }],
      }).countDocuments();
      let open = await Issue.find({
        $or: [{ status: { $ne: "resolved" } }, { status: { $ne: "closed" } }],
      }).countDocuments();
      let users = await User.find({ role: "mobile-client" }).countDocuments();
      let issues = await Issue.find({}, { locationInfo: 1, type: 1 });
      let counties = await County.find({}, { coords: 1, name: 1 }).sort({
        name: 1,
      });
      let latest = await Issue.find({}, { type: 1, description: 1 })
        .limit(5)
        .sort({ createdAt: -1 });
      let topCounties = await Issue.aggregate([
        {
          $group: { _id: "$locationInfo.address.region", total: { $sum: 1 } },
        },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]);
      console.log(topCounties);
      res.json({
        success: true,
        reported,
        resovled,
        open,
        users,
        issues,
        counties,
        latest,
        topCounties,
      });
    } catch (err) {
      console.log(err);
      // res.json({ success: false, message: err.message });
    }
  }
);

async () => {
  County.find({}).then(async (counties) => {
    counties = await Promise.all(
      counties.map(async (each) => {
        let coords = await rp({
          method: "GET",
          uri: `https://api.opencagedata.com/geocode/v1/json?q=${each.name},Kenya&key=90a239d0d8bc4d0a967741fc9daa265c`,
          json: true,
        }).then(async (data) => {
          console.log(
            "[data]",
            data.results[0].formatted,
            data.results[0].geometry
          );
          await County.findOneAndUpdate(
            { _id: each._id },
            { coords: data.results[0].geometry }
          );
          return;
        });

        each.coords = coords;
        return each;
      })
    );
    console.log("Done");
  });
};
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

let transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "webemailkip@gmail.com",
    pass: "parcel1002017",
  },
});
const mailer = (Options) => {
  return new Promise((resolve, reject) => {
    transporter
      .sendMail(Options)
      .then((res) => resolve({ success: true }))
      .catch((err) => {
        reject({ success: false, message: err.message });
      });
  });
};

const parseUser = (user) => {
  if (user.role == "admin") {
    delete user.students;
    delete user.trainers;
    delete user.instructors;
    delete user.courses;
  }
  delete user.password;
  delete user.__v;
  return user;
};
const capitalize = (st) => {
  if (st) return st.charAt(0).toUpperCase() + st.slice(1);
  else return st;
};
module.exports = router;
