const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const fs = require("fs");

const app = express();

// Middleware
app.use(bodyParser.json());

// Mongo URI
const mongoURI = "mongodb://localhost:27017/sampleuploads";

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs;

conn.once("open", () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(6, (err, buf) => {
        if (err) {
          return reject(err);
        }

        const modified = file.originalname.replace(/\s+/g, "-");

        const filename = `${buf.toString("hex")}-${modified}`;
        // path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
          chunkSize: 1 * 1024 * 1024,
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.send(files);
    } else {
      files.map((file) => {
        if (
          file.contentType === "image/jpeg" ||
          file.contentType === "image/png"
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.send(files);
    }
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  // res.json({ file: req.file });
  res.redirect("uploaded successfully");
});

app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "No files exist",
      });
    }

    // Files exist
    return res.json(files);
  });
});

app.get("/files/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists",
      });
    }
    // File exists
    return res.json(file);
  });
});

app.get("/song/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists",
      });
    }

    if (req.headers["range"]) {
      var parts = req.headers["range"].replace(/bytes=/, "").split("-");
      var partialstart = parts[0];
      var partialend = parts[1];

      var start = parseInt(partialstart, 10);
      var end = partialend ? parseInt(partialend, 10) : file.length - 1;
      var chunksize = end - start + 1;

      res.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Range": "bytes " + start + "-" + end + "/" + file.length,
        "Content-Type": file.contentType,
      });

      gfs
        .createReadStream({
          _id: file._id,
          range: {
            startPos: start,
            endPos: end,
          },
        })
        .pipe(res);
    } else {
      res.header("Content-Length", file.length);
      res.header("Content-Type", file.contentType);

      gfs
        .createReadStream({
          _id: file._id,
        })
        .pipe(res);
    }
  });
});

app.delete("/files/:id", (req, res) => {
  gfs.remove({ _id: req.params.id, root: "uploads" }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }

    res.status(gridStore);
  });
});

const port = 5000;

app.listen(port, () => console.log(`Server started on port ${port}`));
