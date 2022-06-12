const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "jsbkBDJBASJDBJjjd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//register-API-1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined && request.body.password.length >= 6) {
    const createUserQuery = `
      INSERT INTO 
        user (username, password, name, gender) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}', 
          '${name}',
          '${gender}'
        );`;
    const dbResponse = await db.run(createUserQuery);
    response.status(200);
    response.send("User created successfully");
  } else {
    if (request.body.password.length < 6) {
      response.status = 400;
      response.send("Password is too short");
    } else {
      response.status = 400;
      response.send("User already exists");
    }
  }
});

//Login-API-2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "jsbkBDJBASJDBJjjd");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//Get API-3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const latestTweetQuery = `
        SELECT 
            user.username AS username,
            tweet.tweet AS tweet,
            tweet.date_time AS dateTime
        FROM user JOIN tweet ON user.user_id = tweet.user_id
        ORDER BY 
        tweet.date_time
        LIMIT 4;`;
  const tweetResponse = await db.all(latestTweetQuery);
  response.send(tweetResponse);
});

//Get API-4

app.get("/user/following/", async (request, response) => {
  const followingQuery = `
        SELECT 
            DISTINCT name
        FROM user JOIN follower ON user.user_id = follower.following_user_id;`;
  const followingResponse = await db.all(followingQuery);
  response.send(followingResponse);
});

//Get API-5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const followerQuery = `
        SELECT 
            DISTINCT name
        FROM user JOIN follower ON user.user_id = follower.follower_user_id;`;
  const followerResponse = await db.all(followerQuery);
  response.send(followerResponse);
});

//Get API-6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const tweetsQuery = `
            SELECT 
                T.tweet,
                COUNT(T.like_id) AS likes,
                COUNT(reply.reply_id) AS replies,
                tweet.date_time AS dateTime
            FROM (tweet JOIN like ON tweet.tweet_id = like.tweet_id) AS T JOIN reply ON T.tweet_id = reply.tweet_id;`;
  const tweets = await db.all(tweetsQuery);
  response.send(tweets);
});

//Get API-7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const likesQuery = `
            SELECT 
                user.name 
            FROM user JOIN like  ON user.user_id = like.user_id
            WHERE tweet_id = ${tweetId};`;

    const likesResponse = await db.all(likesQuery);
    response.send({ likes: likesResponse });
  }
);

//Get API-8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const replyQuery = `
            SELECT 
                user.name AS name,
                reply.reply AS reply
            FROM user JOIN reply ON user.user_id = reply.user_id
            WHERE tweet_id = ${tweetId};`;

    const replyResponse = await db.all(replyQuery);
    response.send({ replies: replyResponse });
  }
);

//Get API-9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const usersQuery = `
            SELECT 
                tweet.tweet,
                COUNT(like.like_id) AS likes,
                COUNT(reply.reply) AS replies,
                tweet.date_time AS dateTime
                FROM (user JOIN tweet ON user.user_id = tweet.user_id) AS T JOIN like ON T.user_id = like.user_id JOIN reply ON like.user_id = reply.user_id;`;
  const usersResponse = await db.all(usersQuery);
  response.send(usersResponse);
});

//Post API-10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const updateQuery = `
            INSERT INTO tweet(tweet)
            VALUES(
                '${tweet}'
            );`;
  await db.run(updateQuery);
  response.send("Created a Tweet");
});

//Post API-11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteQuery = `
            DELETE FROM
                tweet 
            WHERE tweet_id = ${tweetId};`;

    await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
);

module.exports = app;
