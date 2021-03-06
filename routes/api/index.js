const router = require("express").Router();

router.use("/users", require("./users"));
router.use("/admin", require("./admin"));
router.use("/issues", require("./issues"));

module.exports = router;
