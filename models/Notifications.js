const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const NotificationsSchema = new Schema(
  {
    title: {
      type: String
    },
    body: {
      type: String // Body or description
    },
    type: {
      type: String
    },
    to: {
      type: String // "ExponentPushToken[20Op7YOrhkk5t5EKNUO827]", or io room
    },
    channel: {
      type: String,
      enum: ["io", "push"]
    },

    opened: {
      type: Boolean, // for io,
      default: false
    },
    doc: { type: Object },
    initiator: { type: Schema.Types.ObjectId, ref: "Users" }
  },
  { timestamps: true }
);

NotificationsSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    title: this.title,
    body: this.body,
    type: this.type,
    to: this.to,
    channel: this.channel,
    doc: this.doc,
    opened: this.opened,
    initiator: this.initiator,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

NotificationsSchema.index(
  {
    _id: "text",
    fname: "text",
    sname: "text",
    lname: "text",
    email: "text",
    role: "text",
    status: "text",
    county: "text",
    subcounty: "text",
    residence: "text"
  },
  {
    weights: {
      email: 5,
      fname: 4,
      sname: 4,
      idnumber: 5,
      oname: 4,
      county: 4,
      subcounty: 4,
      role: 3,
      status: 2,
      _id: 1
    }
  }
);

NotificationsSchema.plugin(mongoosePaginate);
mongoose.model("Notifications", NotificationsSchema);
