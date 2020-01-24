const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const UsersSchema = new Schema(
  {
    email: {
      type: String
    },
    alt_email: {
      type: String
    },
    fname: {
      type: String
    },

    lname: {
      type: String
    },
    gender: {
      type: String,
      enum: ["male", "female"]
    },
    DOB: {
      type: Date
    },
    phone_number: {
      main: {
        type: String
      },
      alt: {
        type: String
      }
    },
    salutation: {
      type: String,
      enum: ["mr", "mrs", "miss", "dr", "prof", "other", "approval-denied"],
      default: "other"
    },
    idNumber: {
      type: Number
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending-approval", "approval-denied"],
      default: "active",
      required: true
    },
    password: {
      type: String,
      required: true
    },
    reset: { type: Object },

    isSetUp: {
      type: Boolean,
      default: false
    },
    addedBy: {
      type: Schema.ObjectId,
      ref: "Users"
    },
    // added:
    // 	[
    // 	{
    // 		type:Schema.ObjectId,
    // 		ref:'UsersSchema'
    // 	}
    // 	]
    // ,
    //Required for manager
    manager_type: {
      type: String,
      enum: ["Chair", "Treasurer", "Secretary"]
    },

    //role for all other users of the system. required
    role: {
      type: String,
      enum: [
        "parent",
        "instructor",
        "trainer",
        "chief-trainer",
        "admin",
        "manager",
        "contact-person"
      ],

      required: true
    },
    //Both county and sub count must be known for all users
    county: {
      type: String
    },
    sub_county: {
      type: String
    },

    //Required for chief trainer
    trainers: [
      {
        type: Schema.ObjectId,
        ref: "Users"
      }
    ],

    instructors: [
      {
        type: Schema.ObjectId,
        ref: "Users" //required for trainers
      }
    ],

    courses: [
      {
        type: Schema.ObjectId,
        ref: "Courses" //required for trainers
      }
    ],

    school: {
      type: Schema.ObjectId,
      ref: "Schools" //required for trainer and instructor
    },

    students: [
      {
        type: Schema.ObjectId,
        ref: "Students" //Required for parent and instructor
      }
    ],

    trainerId: {
      type: Schema.ObjectId,
      ref: "Users" //required for instructor
    },
    residence: {
      type: String //required for parent
    }
  },
  { timestamps: true }
);

UsersSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    fname: this.fname,
    sname: this.sname,
    lname: this.lname,
    gender: this.gender,
    DOB: this.DOB,
    email: this.email,
    role: this.role,
    status: this.status,
    password: this.password,
    trainers: this.trainers,
    instructors: this.instructors,
    courses: this.courses,
    school: this.school,
    students: this.students,
    residence: this.residence,
    county: this.county,
    sub_county: this.sub_county,
    trainerId: this.trainerId,

    reset: this.reset,
    interests: this.interests,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

UsersSchema.index(
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

UsersSchema.plugin(mongoosePaginate);
mongoose.model("Users", UsersSchema);
