const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5001;

// Parser
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://workvista-167d6.web.app",
      "https://workvista-167d6.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Middlewares
const verifyToken = (req, res, next) => {
  let token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  if (token) {
    jwt.verify(token, process.env.TOKEN_SECRET, (err, decode) => {
      if (err) {
        return res.status(403).send({ message: "Forbidden" });
      }
      req.user = decode;
      next();
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gef2z8f.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const categoriesCollection = client.db("WorkVista").collection("categories");
  const myBidsCollection = client.db("WorkVista").collection("myBids");

  try {
    // Token generation API
    app.post("/access-token", async (req, res) => {
      let user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("accessToken", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // Clear Cookie from user's browser upon logging out API
    app.post("/clearCookie", async (req, res) => {
      let user = req.body;
      res.clearCookie("accessToken", { maxAge: 0 }).send({ success: true });
    });

    // Get categories Data (GET Method)
    app.get("/categories", async (req, res) => {
      try {
        let query = {};
        let category = req.query.category;
        if (category) {
          query.category = category;
        }
        let cursor = await categoriesCollection.find(query).toArray();
        res.send(cursor);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Get Specific job data for job details page (GET Method)
    app.get("/categories/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const result = await categoriesCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    //Storing data to myBids collection
    app.post("/myBids", verifyToken, async (req, res) => {
      try {
        if (req.body.yourEmail !== req.user.email) {
          return res.status(403).send({
            message: "You are trying to get data you have no access to",
          });
        }

        await myBidsCollection.insertOne(req.body);
        res.status(200).send("Data stored successfully");
      } catch (error) {
        console.error("Error storing data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/myBids", verifyToken, async (req, res) => {
      if (req.query.email !== req.user.email) {
        return res.status(403).send({
          message: "You are trying to get data you have no access to",
        });
      }

      let email = req.query.email;
      const cursor = myBidsCollection
        .find({ yourEmail: email })
        .sort({ status: 1 });
      let result = await cursor.toArray();
      res.send(result);
    });

    // GET bid requests data filtered by email
    app.get("/bidRequests", verifyToken, async (req, res) => {
      if (req.query.email !== req.user.email) {
        return res.status(403).send({
          message: "You are trying to get data you have no access to",
        });
      }

      let email = req.query.email;
      const cursor = myBidsCollection.find({ buyerEmail: email });
      let result = await cursor.toArray();
      res.send(result);
    });

    // Update status from bid requests API
    app.put("/bidRequests/:id", verifyToken, async (req, res) => {
      try {
        const itemId = req.params.id;
        const { status } = req.body;

        await myBidsCollection.updateOne(
          { _id: new ObjectId(itemId) },
          { $set: { status: status } }
        );

        res.status(200).send("Status updated successfully");
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // API to store data from add a job page
    app.post("/categories", verifyToken, async (req, res) => {
      try {
        if (req.body.email !== req.user.email) {
          return res.status(403).send({
            message: "You are trying to get data you have no access to",
          });
        }

        await categoriesCollection.insertOne(req.body);
        res.status(200).send("Data stored successfully");
      } catch (error) {
        console.error("Error storing data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //Get specific data for my posted jobs filtered by email
    app.get("/myPosts", verifyToken, async (req, res) => {
      if (req.query.email !== req.user.email) {
        return res.status(403).send({
          message: "You are trying to get data you have no access to",
        });
      }

      let query = {};
      let email = req.query.email;
      if (email) {
        query.email = email;
      }
      let cursor = await categoriesCollection.find(query).toArray();
      res.send(cursor);
    });

    // PUT route for updating data
    app.put("/categories/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const result = await categoriesCollection.updateOne(
          filter,
          { $set: updatedData },
          options
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Error updating data" });
      }
    });

    // Delete API to delete a job
    app.delete("/categories/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await categoriesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is up and running");
});

app.listen(port, () => {
  console.log(`WorkVista Server listening on port ${port}`);
});
