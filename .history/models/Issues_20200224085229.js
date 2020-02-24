const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const IssueSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users" },
    county: { type: String },
    sub_county: { type: String }
  },
  { timestamps: true }
);

IssueSchema.methods.toJSON = () => {
  return {
    _id: this._id,

    userId: this.userId
  };
};

IssueSchema.index();

IssueSchema.plugin(mongoosePaginate);
mongoose.model("Issue", IssueSchema);
