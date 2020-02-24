const mongoose = require("mongoose");
const router = require("express").Router();
const uniqid = require("uniqid");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = mongoose.model("Users");
const Issue = mongoose.model("Issues");
const cloudinary = require("cloudinary");
const formidable = require("formidable"),
  fs = require("fs"),
  path = require("path");
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
      maxFileSize: 1024 * 1024 * 10
    };

    const form = formidable(options);
    //console.log(req.user)
    new Promise((resolve, reject) => {
      form.parse(req);
      let issueDetails = {};
      let images = [];
      form.on("error", err => {
        return res
          .status(200)
          .json({ message: "An error occuredc in processing your request" });
      });
      form.on("fileBegin", (filename, file) => {
        let img = uniqid("image_") + path.extname(file.name);
        file.path = path.join(__dirname + "/../../public/uploads/") + img;
        images.push(file);
      });
      form.on("field", (field, name) => {
        console.log(JSON.parse(name));
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
        new Issue({ da, userId: user._id })
          .save()
          .then(newIssue => {
            console.log(newIssue);
            res
              .status(200)
              .json({ success: true, uploaded: true, issue: newIssue });
          })
          .catch(err => {
            reject(err);
          });
      });
    });
  }
);
module.exports = router;
