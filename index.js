const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
require('dotenv').config()

const mySecret = process.env['MONGO_URI']

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect(mySecret, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('connected to db')
}
app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'))

const logSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  },
  log: [logSchema]
});

const Users = mongoose.model("Users", userSchema);

const createNewUser = async (req, res, next) => {
  try {
    let user = new Users({username: req.body.username});
    req.addedUser = await user.save();
    next();    
  } catch (error) {
    console.log(error)
    res.send("OOPS... Something went wrong. Please Try Again.")   
  }
};

const findUser = async (req, res, next) => {
    try {
      let searchUser = req.params._id ? {_id: mongoose.Types.ObjectId(req.params._id)} : {}
      let searchLimit = req.query.limit ? Number(req.query.limit) : 100 
      let searchFrom = req.query.from ? req.query.from : '1969-12-31'
      let searchTo = req.query.to ? req.query.to : '3000-01-01'

      let query = [
        {'$match': searchUser},
        {'$unwind': {'path': '$log'}},
        {'$sort': {'log.date': 1}},
        {'$match': {'log.date': {'$gte': new Date(searchFrom), '$lte': new Date(searchTo)}}},
        {'$limit': searchLimit},
        {'$group': {
          '_id': '$_id', 
          'username': {'$min': '$username'}, 
          'count': {'$min': '$count'}, 
          'log': {'$push': '$log'}
          }}
        ]
     
      req.foundUser = await Users.aggregate(query)
      console.log(`findUser.unwoundUser: ${JSON.stringify(req.foundUser)}`)
      next();
  } catch (error) {
    console.log(error)
    res.send("OOPS... Something went wrong. Please Try Again.")
  }
}

const findUserAddExercise = async (req, res, next) => {
  try {
    console.log(`findUserAddExercise.req.params._id: ${JSON.stringify(req.params._id)}`)
    let date = req.body.date ? req.body.date : Date.now()
    req.exerciseToAdd = {
      description: req.body.description,
      duration: Number(req.body.duration),
      date: new Date(date).toDateString()
    }
    console.log(`findUserAddExercise.exerciseToAdd: ${JSON.stringify(req.exerciseToAdd)}`)
    let user = await Users.findById(req.params._id)
    console.log(`findUserAddExercise.user: ${user}`)
    user.log.push(req.exerciseToAdd)
    user.count = user.log.length
    let savedUser = await user.save()
    console.log(`findUserAddExercise.savedUser: ${savedUser}`)
    req.username = savedUser.username
    next();   
  } catch (error) {
    console.log(error)
    res.send("OOPS... Something went wrong. Please Try Again.")
  }
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.get('/api/users/:_id?', findUser, async (req, res) => {
    res.json(req.foundUser.map((user) => {
      return ({username: user.username, _id: user._id})
    }));
  })

app.post('/api/users', createNewUser, (req, res) => {
    res.json({
      username: req.addedUser.username,
      _id: req.addedUser._id
    });
  });

app.get('/api/users/:_id/logs?', findUser, async (req, res) => {
  console.log(`GET.logs.foundUser: ${req.foundUser}`)
  let [data] = req.foundUser  
  let userLog = {
    username: data.username,
    count: data.count,
    _id: data._id,
    log: data.log.map((exercise) => {
      return {
        description: exercise.description,
        duration: exercise.duration,
        date: new Date(exercise.date).toDateString()
      }
    })
  }
  res.json(userLog)
})

app.post('/api/users/:_id/exercises', findUserAddExercise, async (req, res) => {
  console.log("In POST exercises")
  res.json({
    username: req.username,
    ...req.exerciseToAdd,
    _id: req.params._id
  })
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
