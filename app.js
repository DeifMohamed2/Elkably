require('dotenv').config()
const express = require('express');
const morgan = require('morgan')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo')
const session = require('express-session')
const fileUpload = require('express-fileupload');
const cors = require('cors')
const socketio = require('socket.io');

const homeRoutes = require('./routes/homeRoutes')
const teacherRoutes = require('./routes/teacherRoutes')
const parentRoute = require('./routes/parentRoute')

// express app
const app = express();
app.use(express.json());

// CONNECT to MongoDB
const dbURI = 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/elkably?retryWrites=true&w=majority&appName=Cluster0'
let io;

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 })
    .then((result) => {
        const server = app.listen(8400);
        
        // Initialize Socket.io
        io = socketio(server);
        io.on('connection', (socket) => {
            console.log(`New socket connection: ${socket.id}`);
            
            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
        });
        
        console.log("Server running on port 8400");
    })
    .catch((err) => {
        console.log("MongoDB connection error:", err);
    });

// Register view engine
app.set('view engine', 'ejs');

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());

// Session middleware
app.use(session({
    secret: "Keybord",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: dbURI
    }),
}));

// Make io accessible in all routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/', homeRoutes);
app.use('/teacher', teacherRoutes);
app.use('/api/parent', parentRoute);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: '404' });
});
