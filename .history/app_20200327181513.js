const path = require("path");
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const errorHandler = require("errorhandler");
const mongoose = require("mongoose");
const useragent = require("express-useragent");
(async function() {
  try {
    mongoose.promise = global.Promise;
    mongoose.set("useCreateIndex", true);
    mongoose
      .connect(
        "mongodb+srv://system:hello123@cluster0-flpph.mongodb.net/issueReporting?retryWrites=true",
        { useNewUrlParser: true, useUnifiedTopology: true }
      )
      .catch(err => {
        console.log("[Mongo Connect Err]", err);
      });
  } catch (err) {
    console.log("[Mongo Connect Err]", err);
  }
  useMongoClient: true;
})();
const isProduction = process.env.NODE_ENV === "production";
const app = express();

// our server instance
const server = http.createServer(app);

// This creates our socket using the instance of the server
const io = socketIO(server);

const PORT = process.env.PORT || 8081;
const IP = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || "localhost";
// set the view engine to ejs

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204
  })
);
app.use(require("morgan")("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));
app.use(
  session({
    secret: "LightBlog",
    cookie: { maxAge: 60000 },
    resave: false,
    saveUninitialized: false
  })
);
//Get user agent
app.use((req, res, next) => {
  const source = req.headers["user-agent"],
    ua = useragent.parse(source);
  // console.log("[User Agent]", ua);
  req.ua = ua;
  next();
});
const passport = require("passport");
// Add models

require("./models/Users");
require("./models/GuestUsers");
require("./models/Counties");
require("./models/Issues");
require("./models/Notifications");

//mongoose models

const User = mongoose.model("Users");

//CreateCollections

// Request.createCollection();
// Parent.createCollection();

require("./passport")(passport);
//io file
const ioFile = require("./socket.io/socket.io")(io);
// Make io accessible to our router
app.use((req, res, next) => {
  req.io = io;
  next();
});
// Add routes
app.use(require("./routes"));

//app.get("/",(req,res)=>{res.send('Hi sir')});
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

if (!isProduction) {
  app.use((err, req, res) => {
    res.status(err.status || 500);
    res.json({
      errors: {
        message: err.message,
        error: err
      }
    });
  });
}
let m = 3;
let z = 4;
app.use((err, req, res) => {
  res.status(err.status || 500);

  res.json({
    errors: {
      message: err.message,
      error: {}
    }
  });
});

server.listen(PORT, IP, () =>
  console.log(
    `ISSUE REPORTING SERVER IS RUNNING!!!, on  ip ${IP} port :${PORT}`
  )
);
