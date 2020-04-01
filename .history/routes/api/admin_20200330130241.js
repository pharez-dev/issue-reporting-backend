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
router.post("/login", (req, res, next) => {
  const { body } = req;
  console.log(body);
  let email = body.email;
  let password = body.password;
  let remember = body.remember;
  User.findOne({ email }).then(user => {
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Incorrect email or --password!"
      });
    }
    if (user.role !== "admin") {
      return res.status(200).json({
        success: false,
        message: "Incorrect email or --password!"
      });
    }
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        if (user.status == "pending-approval")
          return res.status(200).json({
            success: false,
            message:
              "Your account is yet to be approved. It might take a while as your info has to be reviewed!"
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
            expiresIn: body.remember ? "365d" : 60 * 30
          },
          (err, token) => {
            if (err) console.error("There is some error in token", err);
            else {
              res.json({
                success: true,
                token: `Bearer ${token}`,

                message: "You have successfully logged in"
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
    phoneNumber: body.phoneNumber
  }).then(user => {
    if (user) {
      return res
        .status(200)
        .json({ success: false, message: "Phone number already in use" });
    } else {
      User.findOne({
        email: body.email
      }).then(user => {
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

            password: body.password
          });

          bcrypt.genSalt(10, (err, salt) => {
            if (err) console.error("There was an error", err);
            else {
              bcrypt.hash(newUser.password, salt, (err, hash) => {
                if (err) console.error("There was an error", err);
                else {
                  newUser.password = hash;
                  newUser.save().then(user => {
                    user = user.toObject();
                    delete user.password;
                    const payload = {
                      id: user._id,
                      fname: user.fname,
                      lname: user.lname,

                      email: user.email,
                      isVerified: user.isVerified
                    };
                    jwt.sign(
                      payload,
                      "secret",
                      {
                        expiresIn: 90000
                      },
                      (err, token) => {
                        if (err)
                          console.error("There is some error in token", err);
                        else {
                          res.json({
                            success: true,
                            token: `Bearer ${token}`,

                            message: "Registration Successful"
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
      .then(data => {
        res.json({ success: true, data });
      })
      .catch(err => {
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
      .then(data => {
        res.json({ success: true, data });
      })
      .catch(err => {
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
  (req, res, next) => {
    const { body } = req;
    const { user } = req;
    console.log("[body]", body);
    // Notification.find({ to: user.role, opened: false })
    //   .sort({ createdAt: -1 })
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
    console.log(body);
    Issue.findById(body._id)

      .then(issue => {
        issue.status = body["radio-button"];
        issue.response.push({
          by: req.user._id,
          message: body.message,
          statusTo: body["radio-button"],
          time: new Date()
        });
        return issue
          .save()
          .then(async newIssue => {
            return newIssue;
          })
          .then(async issue => {
            //fetch responders
            let responders = issue.response.map(each => {
              return mongoose.Types.ObjectId(each.by);
            });
            responders = await User.find({ _id: { $in: responders } });
            let newIss = Object.assign({}, issue._doc);

            newIss.response = newIss.response.map((each, i) => {
              let response = Object.assign({}, each._doc);
              //  console.log(response);
              responders.map(user => {
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
          .catch(err => {
            console.log(err);
            res.json({ success: false, message: err.message });
          });
        // res.json({ success: true, data });
      })
      .catch(err => {
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
            time: new Date()
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
            time: new Date()
          });
          issue.escalated = {
            bool: true,
            to: [body.escalateTo]
          };

          break;
        case "close":
          issue.status = "closed";
          issue.response.push({
            by: req.user._id,

            message: body.reason,
            statusTo: "closed",
            time: new Date()
          });
          issue.closed = {
            by: req.user._id,
            reason: body.reason,
            time: new Date()
          };
          //Notify user
          break;
      }
      issue = await issue.save();
      console.log("{new issue}", issue);
      /**
       * fetch responders
       *  */
      let responders = issue.response.map(each => {
        return mongoose.Types.ObjectId(each.by);
      });
      responders = await User.find({ _id: { $in: responders } });
      let newIss = Object.assign({}, issue._doc);
      newIss.response = newIss.response.map((each, i) => {
        let response = Object.assign({}, each._doc);
        //  console.log(response);
        responders.map(user => {
          let by = parseUser(Object.assign({}, user._doc));
          //console.log(by);
          // if(by._id==each.by)
          each = { ...each._doc, by };
        });
        return each;
      });
      console.log(newIss);
      res.json({ success: true, issue: newIss });
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

          { sub_county: { $regex: body.query, $options: "i" } }
        ]
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
        name: { $concat: ["$fname", " ", "$lname"] }
      })
      .sort(sort);
    User.aggregatePaginate(aggregate, {
      page: body.page,
      limit: body.limit
    })
      .then(results => {
        const data = [...results.docs];
        results.docs = data.length;
        res.json({ success: true, issues: data, meta: results });
      })
      .catch(err => {
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
      .then(counties => {
        // console.log("found", county);

        res.json({
          success: true,
          counties
        });
      })
      .catch(err => {
        res.json({
          success: false,
          message: "Failed to get counties!"
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
        json: true
      };
      let wards = await rp(options).then(function(wards) {
        let sub_county = body.sub_county;
        if (sub_county.indexOf("Sub County") > -1)
          sub_county = sub_county.slice(
            0,
            sub_county.indexOf("Sub County") - 1
          );
        if (sub_county.indexOf(".") > -1)
          sub_county = sub_county.slice(0, sub_county.indexOf("."));
        console.log(wards.length, sub_county);
        return (wards = wards.filter(ward => {
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
        email: body.email
      });
      if (inUse) throw new Error("Email is already in use !");
      //Validate phone number
      if (isNaN(body.phone)) throw new Error("Invalid phone number!");
      // const options = {
      //   method: "GET",
      //   uri: `http://apilayer.net/api/validate? access_key=756653a2f405c7dd3283ef464aa47eeb&number=${body.phone}&country_code=KE&format=1`,
      //   json: true
      // };
      // let valid = await rp(options);
      // console.log(valid);
      // if (!valid.valid) if (!valid.success) throw new Error(valid.error.info);
      // body.phone = valid.international_format;
      //Generate password
      const password = generator.generate({
        length: 8,
        numbers: true
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
        phone: body.phone,
        role: body.Role,
        County: body.County,
        subCounty: body.subCounty
      };
      if (body.Role == "ward-admin") newUser = body.ward;
      let createdUser = await User.create(newUser);
      console.log(createdUser);
      //Send email
    } catch (err) {
      res.json({ success: false, message: err.message });
    }
  }
);

let transporter = nodemailer.createTransport({
  service: "Yandex",
  auth: {
    user: "issuereport@yandex.com",
    pass: "zaburi1"
  }
});
const mailer = Options => {
  return new Promise((resolve, reject) => {});
};
transporter
  .sendMail({
    from: "Issue Reporting System <issuereport@yandex.com>", // sender address
    to: "kotekunra@gmail.com", // list of receivers
    subject: "Login Details ", // Subject line
    text: "Issue Reporting", // plaintext body
    html: "<b>Welcome to issue reporting system ✔</b>" // html body
  })
  .then(res => console.log("Message sent: " + res.message))
  .catch(err => {
    console.log(err);
  });
const parseUser = user => {
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

module.exports = router;
