require('dotenv').config();
const shortid = require('shortid');
const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.Promise = require('bluebird');
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', {
  useCreateIndex: true,
  useNewUrlParser: true,
  socketTimeoutMS: 0,
  keepAlive: true,
  reconnectTries: 30
})
mongoose.connection.on('error', err => console.error(`MongoDB connection error: ${err}`));

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const User = mongoose.model('User', {
  _id: {
    'type': String,
    'default': shortid.generate
  },
  username: { type: String, unique: true },
  log: [{
    description: String,
    duration: Number,
    date: Date
  }]
})

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', (req, res) => {
  const user = new User({ "username": req.body.username });
  User.find({ username: req.body.username }, function (err, docs) {
    if (docs.length != 0)
      return res.json({
        "error": "username exists already"
      })
  });
  user.save().then(doc => {
    res.json({
      "username": doc.username,
      "_id": doc._id
    })
  }).catch(err => {
    console.error(err)
  })
});

app.post('/api/exercise/add', (req, res) => {
  let doc;
  User.find({ _id: req.body.userId }, function (err, docs) {
    if (docs.length == 0)
      return res.json({
        "error": "userId doesn't exists"
      })
    else {
      doc = docs[0]
      doc.log.push({
        "description": req.body.description,
        "duration": req.body.duration,
        "date": req.body.date,
      })
      doc.save().then(doc => {
        let index = doc.log.length - 1;
        res.json({
          "_id": doc._id,
          "username": doc.username,
          "description": doc.log[index].description,
          "duration": doc.log[index].duration,
          "date": doc.log[index].date
        })
      }).catch(err => {
        console.error(err)
      })
    }
  });
});

app.get('/api/exercise/log', (req, res) => {
  const { userId, from = new Date(0), to = new Date(), limit = Infinity } = req.query
  User.find({ _id: userId }, function (err, docs) {
    if (docs.length == 0) {
      return res.json({
        "error": "userId doesn't exists"
      })
    }
    else {
      let doc = docs[0]
      let log_array = [];
      for (let i = 0, j = 0; i < doc.log.length && j < limit; i++) {
        const element = doc.log[i];
        if (new Date(element.date) > new Date(from) && new Date(element.date) < new Date(to)) {
          j++;
          log_array.push({
            description: element.description,
            duration: element.duration,
            date: element.date
          })
        }
      }
      res.json({
        "_id": doc._id,
        "username": doc.username,
        "count": log_array.length,
        "log": log_array
      })
    }
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
