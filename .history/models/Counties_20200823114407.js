const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const CountiesSchema = new Schema(
  {
    name: {
      type: String,
    },
    capital: {
      type: String,
    },
    code: {
      type: String,
    },
    sub_counties: {
      type: Array,
    },
    coords: {
      type: Object,
    },
  },
  { timestamps: true }
);

CountiesSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    capital: this.capital,
    code: this.code,
    coords: this.coords,

    sub_counties: this.sub_counties,

    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

CountiesSchema.index(
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
    residence: "text",
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
      _id: 1,
    },
  }
);

CountiesSchema.plugin(mongoosePaginate);
mongoose.model("Counties", CountiesSchema);
