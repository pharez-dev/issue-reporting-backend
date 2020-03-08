const mongoose = require("mongoose");
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = mongoose.model("Users");
router.post("/login", (req, res, next) => {
  const { body } = req;
  console.log(body);
  let email = body.email;
  let password = body.password;

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
