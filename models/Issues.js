const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const IssueSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users" },
    county: { type: String },
    reportId: { type: String },
    sub_county: { type: String },
    type: { type: String },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
    images: { type: Array },
    locationInfo: { type: Object },
    description: { type: Object }
  },
  { timestamps: true }
);

IssueSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    userId: this.userId,
    reportId: this.reportId,
    county: this.county,
    sub_county: this.sub_county,
    type: this.type,
    status: this.status,
    locationInfo: this.locationInfo,
    description: this.description,
    images: this.images,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

IssueSchema.index(
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

IssueSchema.plugin(mongoosePaginate);
mongoose.model("Issues", IssueSchema);
