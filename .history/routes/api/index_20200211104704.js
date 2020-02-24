const router = require("express").Router();

router.use("/users", require("./users"));
router.use("/admin", require("./admin"));

module.exports = router;
