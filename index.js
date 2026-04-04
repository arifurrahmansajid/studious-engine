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

module.exports = app;
