const mongoose = require("mongoose");
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const uniqid = require("uniqid");
const User = mongoose.model("Users");
const County = mongoose.model("Counties");
const GuestUser = mongoose.model("GuestUsers");
const path = require("path");

/**
 *Endpoint for loging in, requires checking if user is active ...*
 **/
router.post("/login", (req, res, next) => {
  const { body } = req;
  console.log("[login body]", body);
  let phoneNumber = body.phoneNumber;
  let password = body.password;

  User.findOne({ phoneNumber }).then(user => {
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Incorrect phoneNumber or --password!"
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
            expiresIn: 60 * 30 * 100000
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
    .then(found => {
      if (found) {
        //    console.log("found guest", found);
      }
      return found;
    })
    .then(async found => {
      let guestUser = found;
      if (!found) {
        guestname = "Guest_" + uniqid.time().substring(4, 8);
        console.log(guestname);
        guestUser = await GuestUser.create({
          guestname: guestname,
          deviceId: body.deviceId
        });
      }

      console.log("Guest user", guestUser);
      return res.json({
        success: true,

        guestUser,
        message: "You have successfully logged in"
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
                        expiresIn: "365d"
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
 *Endpoint for subcounties ...*
 **/
router.post(
  "/subcounties",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    console.log("body", body);
    let name;
    if (body.county.indexOf("County") > -1) {
      name = body.county.slice(0, body.county.indexOf("County") - 1);
    }
    console.log(name);
    County.findOne({ name })
      .then(county => {
        console.log("found", county);
        res.json({
          success: true,
          county
        });
      })
      .catch(err => {
        res.json({
          success: false,
          message: "Failed to get sub counties!"
        });
      });
  }
);

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
