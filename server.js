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
    origin: ["http://localhost:5173"],
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
    app.get("/categories/:id", async (req, res) => {
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
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is up and running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
