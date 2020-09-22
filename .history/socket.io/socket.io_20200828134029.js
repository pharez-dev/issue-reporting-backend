const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = mongoose.model("Users");
//const Conversation = mongoose.model("Conversations");
//const Message = mongoose.model("Messages");

exports = module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    //  console.log("[handshake]", socket.handshake.query.num);
    if (token == null || token == undefined) return;
    //    console.log("[Checking token]");
    // verify token
    jwt.verify(token.slice(7), "secret", (err, decoded) => {
      if (err) {
        //console.log(err);
        return next(err);
      }
      // set the user’s mongodb _id to the socket for future use
      //  console.log("[decoded]", decoded);
      User.findById(decoded._id)
        .then((user) => {
          if (user) {
            //console.log(user)
            console.log("Authenticated socket connected: " + user.fname);
            socket.user = user;
            return user;
          }
        })
        .then(async (user) => {
          //Find conversations
          //   let conversations = await Conversation.find({
          //     participants: { $in: user._id }
          //   });
          //   socket.conversations = conversations;
          next();
        })
        .catch((err) => next(err));
    });
  });
  let clients = [];
  // This is what the socket.io syntax is like, we will work this later

  io.on("connection", (socket) => {
    const { user } = socket;
    clients.push(user.fname);
    console.log(clients);
    socket.join(user._id);
    //Joining my user group room
    socket.join(user.role);

    // socket.to(user._id).emit("notification2", {
    //   title: "A new notification from server",
    //   description: "1 hour ago",
    //   type: "new-report",
    //   createdAt: new Date()
    // });

    // socket.conversations.map(each => {
    //   socket.join(each._id);
    //   //  console.log(each._id)
    // });
    //console.log(io.sockets.adapter.rooms)
    // if (socket.request.user.role == 'admin') {
    //       socket.join('adminRoom');

    //   }
    //   else {
    //       socket.join('masterRoom');
    //       // var clients =io.sockets.adapter.rooms['masterRoom'].sockets
    //       //  console.log(clients)
    //   }

    // console.log('New client connected');
    //console.log(socket.request.user.logged_in);
    // socket.nickname = socket.request.user.fname;
    // // console.log(socket.nickname)

    socket.on("disconnect", () => {
      console.log("User disconnected");
      clients.splice(clients.indexOf(socket.user.fname), 1);
      console.log(clients);
      //console.log('Client disconnected');
      // if (socket.request.user.role == 'admin') {
      //     socket.leave('adminRoom');

      // }
      // else {
      //     socket.leave('masterRoom');
      //     // var clients =io.sockets.adapter.rooms['masterRoom'].sockets
      //     // console.log(clients)
      // }
    });
  });
};
