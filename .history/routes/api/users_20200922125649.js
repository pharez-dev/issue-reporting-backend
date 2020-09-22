const mongoose = require("mongoose");
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const uniqid = require("uniqid");
const User = mongoose.model("Users");
const County = mongoose.model("Counties");
const GuestUser = mongoose.model("GuestUsers");
const Issue = mongoose.model("Issues");
const path = require("path");

/**
 *Endpoint for policy ...*
 **/
router.get("/policy", (req, res) => {
  res.render("policy.ejs");
});
/**
 *Endpoint for loging in, requires checking if user is active ...*
 **/
router.post("/login", (req, res, next) => {
  const { body } = req;
  const { pushToken } = body;
  console.log("[body]", body);
  req.io.to("5e53c961bc591b078407ddba").emit("notification2", {
    title: "A new user just tried to login, Phone Number" + body.phoneNumber,
    description: new Date(),
    type: "new-report",
    createdAt: new Date(),
  });
  console.log("[body]", body);

  let phoneNumber = body.phoneNumber;
  let password = body.password;

  User.findOne({ phoneNumber }).then((user) => {
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Incorrect phoneNumber or --password!",
      });
    }
    bcrypt.compare(password, user.password).then(async (isMatch) => {
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

        if (pushToken) {
          console.log("storing pT");
          await storePT(pushToken, "guest", user._id);
        }
        jwt.sign(
          payload,
          "secret",
          {
            expiresIn: 60 * 30 * 100000,
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

/**
 *Endpoint for loging in, requires checking if user is active ...*
 **/
router.post("/loginGuest", (req, res, next) => {
  const { body } = req;
  console.log(body);
  if (!body.deviceId)
    return res
      .status(200)
      .json({ success: false, message: "Failed to continue as guest" });
  GuestUser.findOne({ deviceId: body.deviceId })
    .then((found) => {
      if (found) {
        //    console.log("found guest", found);
      }
      return found;
    })
    .then(async (found) => {
      let guestUser = found;
      if (!found) {
        guestname = "Guest_" + uniqid.time().substring(4, 8);
        console.log(guestname);
        guestUser = await GuestUser.create({
          guestname: guestname,
          deviceId: body.deviceId,
        });
      }

      console.log("Guest user", guestUser);
      return res.json({
        success: true,

        guestUser,
        message: "You have successfully logged in",
      });
    });
});
router.post("/register", async (req, res, next) => {
  const { body } = req;
  console.log("[register body]", body);
  const { pushToken } = body;
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
                  newUser.save().then(async (user) => {
                    // user = user.toObject();

                    const payload = parseUser(user._doc);
                    if (pushToken) {
                      console.log("storing pT");
                      await storePT(pushToken, null, user._id);
                    }
                    jwt.sign(
                      payload,
                      "secret",
                      {
                        expiresIn: 60 * 30 * 100000,
                      },
                      (err, token) => {
                        console.log("token", token);
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
 *Endpoint for subcounties ...*
 **/
router.post(
  "/subcounties",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    console.log("body", body);
    let name = body.county;
    if (body.county.indexOf("County") > -1) {
      name = body.county.slice(0, body.county.indexOf("County") - 1);
    }
    console.log(name);
    County.findOne({ name: { $regex: name, $options: "i" } })
      .then((county) => {
        // console.log("found", county);
        if (county == null) county = { sub_counties: [] };
        res.json({
          success: true,
          county,
        });
      })
      .catch((err) => {
        res.json({
          success: false,
          message: "Failed to get sub counties!",
        });
      });
  }
);
/**
 *Endpoint for fetching issues user reported ...*
 **/
router.post(
  "/allIssues",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    //console.log("[body of all ]", body);
    let IssuesReported = await Issue.find().countDocuments();
    let IssuesResovled = await Issue.find({
      $or: [{ status: "resolved" }, { status: "closed" }],
    }).countDocuments();

    console.log(IssuesReported, IssuesResovled);
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
    // console.log("[filter]", filter);
    //Searching
    if (body.query) {
      body.query = kebab(body.query);
      search = {
        $or: [
          { type: { $regex: body.query, $options: "i" } },
          { status: { $regex: body.query, $options: "i" } },

          { description: { $regex: body.query, $options: "i" } },
        ],
      };
    }
    let aggregate = Issue.aggregate()
      .match({
        $and: [search, filter, { userId: req.user._id }],
      })
      .sort(sort);
    Issue.aggregatePaginate(aggregate, {
      page: body.page,
      limit: body.limit,
    })
      .then((results) => {
        let data = [...results.docs];
        data = data.map((each) => {
          each.images = each.images.map((image) => {
            image = image.replace("/upload/", "/upload/h_360,q_auto,f_auto/");
            return image;
          });

          return each;
        });
        //console.log(data);
        results.docs = data.length;
        res.json({
          success: true,
          issues: data,
          meta: results,
          IssuesReported,
          IssuesResovled,
        });
      })
      .catch((err) => {
        console.log(err);
        res.json({ success: false, message: err.message });
      });
  }
);
/**
 *Endpoint for resolving responder ids  ...*
 **/
router.post(
  "/responses",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    let { response } = req.body;
    try {
      let ids = response.map((each) => mongoose.Types.ObjectId(each.by));

      let userInfo = await User.find(
        { _id: { $in: ids } },
        { fname: 1, lname: 1, role: 1 }
      );
      response = response.map((each) => {
        userInfo.map((info) => {
          if (info._id == each.by)
            each.by = info.fname + " " + info.lname + "- Sub County Admin ";
        });
        return each;
      });
      return res.json({ success: true, response });
    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }
);

/**
 *Endpoint for updating user profile*
 **/
router.post(
  "/update_profile",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { body } = req;
    console.log("[update body]", body);
    const { fname, lname, email, phoneNumber } = req.body;
    try {
      if (user.email !== email) {
        await User.findOne({ email });
        if (user) {
          return res.json({
            success: false,
            message: "Email is already in use!",
          });
        }
      }
      User.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.user._id) },
        { name, email, phoneNumber, phoneCode },
        { new: true }
      ).then((data) => {
        const user = parseUser(data._doc);
        jwt.sign(
          user,
          "secret",
          {
            expiresIn: 60 * 30 * 100000,
          },
          (err, token) => {
            if (err) console.error("There is some error in token", err);
            else {
              res.json({
                success: true,
                token: `Bearer ${token}`,
                user,
              });
            }
          }
        );
      });
    } catch (e) {
      console.log(e);
      res.status(200).json({
        success: false,
        message: e.message,
      });
    }
  }
);
/**
 *Endpoint for changing password*
 **/
router.post(
  "/update_password",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    const { pushToken } = body;
    const { oldpassword, newpassword } = req.body;
    console.log("[body]", body);
    //return;

    User.findOne({ _id: mongoose.Types.ObjectId(req.user._id) }).then(
      (user) => {
        if (!user) {
          return res.status(200).json({
            success: false,
            message: "An error occurred in changing your password!",
          });
        }
        bcrypt.compare(oldpassword, user.password).then(async (isMatch) => {
          if (isMatch) {
            //hash new password
            bcrypt.genSalt(10, (err, salt) => {
              if (err) console.error("There was an error", err);
              else {
                bcrypt.hash(newpassword, salt, (err, hash) => {
                  if (err) console.error("There was an error", err);
                  else {
                    user.password = hash;
                    user.save().then(async (user) => {
                      // user = user.toObject();

                      res.json({
                        success: true,

                        message: "Your password was udated successfully",
                      });
                    });
                  }
                });
              }
            });
            // jwt.sign(
            //   payload,
            //   "secret",
            //   {
            //     expiresIn: 60 * 30 * 100000,
            //   },
            //   (err, token) => {
            //     if (err) console.error("There is some error in token", err);
            //     else {
            //       res.json({
            //         success: true,
            //         token: `Bearer ${token}`,
            //         message: "Login successful, Taking you to Home!",
            //       });
            //     }
            //   }
            // );
          } else {
            return res
              .status(200)
              .json({ success: false, message: "Incorrect current password!" });
          }
        });
      }
    );
  }
);

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
const storePT = async (token, type, _id) => {
  return new Promise((resolve, reject) => {
    if (_id == null) reject("id cannot be null");
    if (token == null) reject("token cannot be null");
    User.findByIdAndUpdate(_id, { pushToken: token })
      .then((doc) => {
        //  console.log("[pt]", doc);
        resolve();
      })
      .catch((err) => {
        console.log(err);
        reject();
      });
  });
};

kebab = (string) => {
  if (string) {
    string = string
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  return string;
};

module.exports = router;
