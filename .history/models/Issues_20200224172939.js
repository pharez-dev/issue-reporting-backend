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
    images: { type: Array },
    locationInfo: { type: Object },
    description: { type: Object }
  },
  { timestamps: true }
);

IssueSchema.methods.toJSON = () => {
  return {
    _id: this._id,
    userId: this.userId,
    reportId: this.reportId,
    county: this.sub_county,
    type: this.type,
    locationInfo: this.locationInfo,
    description: this.description,
    images: this.images,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

IssueSchema.index();

IssueSchema.plugin(mongoosePaginate);
mongoose.model("Issues", IssueSchema);