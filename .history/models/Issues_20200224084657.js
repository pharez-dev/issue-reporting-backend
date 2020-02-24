const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const IssueSchema = new Schema({ timestamps: true });

IssueSchema.methods.toJSON = () => {
  return {};
};

IssueSchema.index();

IssueSchema.plugin(mongoosePaginate);
mongoose.model("Property", IssueSchema);
