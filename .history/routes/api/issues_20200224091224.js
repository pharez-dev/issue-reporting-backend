const mongoose = require("mongoose");
const router = require("express").Router();
const uniqid = require("uniqid");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = mongoose.model("Users");
const Issue = mongoose.model("Issues");
