const mongoose = require("mongoose");
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const uniqid = require("uniqid");
const User = mongoose.model("Users");

const GuestUser = mongoose.model("GuestUsers");
const path = require("path");

/**
 *Endpoint for loging in, requires checking if user is active ...*
 **/
router.post("/login", (req, res, next) => {
  const { body } = req;

  if (!body.email) {
    return res.status(422).json({
      errors: {
        email: "is required"
      }
    });
  }

  if (!body.password) {
    return res.status(422).json({
      errors: {
        password: "is required"
      }
    });
  }
  let email = body.email;
  let password = body.password;
  let errors = {};
  User.findOne({ email }).then(user => {
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "Incorrect email or password!" });
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
            expiresIn: 60 * 30
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

module.exports = router;
