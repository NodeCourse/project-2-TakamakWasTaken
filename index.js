const Sequelize = require('sequelize');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const COOKIE_SECRET = 'cookie secret';

const db = new Sequelize('gamereview', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});
const User = db.define('user', {
    firstname: { type: Sequelize.STRING },
    lastname: { type: Sequelize.STRING },
    email: { type: Sequelize.STRING },
    password: { type: Sequelize.STRING }
});

const Comment = db.define('comment', {
    content: { type: Sequelize.STRING },
    userfirstname: { type: Sequelize.STRING }
});

const Review = db.define('review', {
        game: { type: Sequelize.STRING },
        note: { type: Sequelize.INTEGER },
        content: { type: Sequelize.STRING }
    },
    {
        getterMethods: {
            score(){
                let total = 0;
                for(let i = 0; i< this.votes.length; i++){
                    if(this.votes[i].action === 'like'){
                        total += 1;
                    }
                    else{
                        total = total - 1;
                    }
                }
                return total;
            }
        }
    }
);

const Vote = db.define('vote', {
    action: {
        type: Sequelize.ENUM('like', 'dislike') //liste les différentes valeurs possibles.
    }
});

Review.hasMany(Vote);
Vote.belongsTo(Review);

User.hasMany(Review);
Review.belongsTo(User);

User.hasMany(Comment);
Comment.belongsTo(User);

Review.hasMany(Comment);
Comment.belongsTo(Review);



const app = express();

app.set('view engine', 'pug');
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: COOKIE_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Initialize passport, it must come after Express' session() middleware
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((email, password, cb) => {

    // Find a user with the provided username (which is an email address in our case)
    User
    .findOne({ where: {
        email, password
    }
    })
    .then(user => {
    if(user){
        return cb(null, user);
    }
    else{
        return cb(null, false, {
            error: "email ou mot de passe inconnu."
        });
}
});
}));

// Save the user's email address in the cookie
passport.serializeUser((user, cb) => {
    cb(null, user.email);
});

passport.deserializeUser((username, cb) => {
    // Fetch the user record corresponding to the provided email address
    User
    .findOne({ where: {
        email: username
    }})

    .then((user) =>{
    cb(null, user);
})
});



app.get('/api/signUp', (req, res) => {
    res.render('signUp');
})

app.post('/api/signUp', (req, res) => {
    const firstname = req.body.firstname;
    const lastname = req.body.lastname;
    const email = req.body.email;
    const password = req.body.password;

    if(firstname != null && lastname != null && email != null && password != null){
        User
            .create({
                firstname: firstname,
                lastname: lastname,
                email: email,
                password: password
            })
            .then((user) => {
            req.login(user, () => {
            res.redirect('/');
    });
    })
    .catch((error) =>{
            res.render('500', {error: error})
    });
    }
else{
    console.log("L'utilisateur n'a pas pu être créé.")
}
});

//--------------------------------------------------

app.get('/api/review/:reviewId/comment', (req, res) => {

    if(req.user){
        User
            .findOne({where: {id: req.user.id}})
            .then((user) => {
                Comment
                    .create({
                        content: req.query.content,
                        reviewId: req.params.reviewId,
                        userId: req.user.id,
                        userfirstname: user.firstname
                    })
                    .then(() => res.redirect('/'));
            })

    }
    else{
        res.redirect("/api/login");
    }


});

app.post('/api/review/:reviewId/upvote', (req, res) => {

    Vote
        .create({action: 'like', reviewId: req.params.reviewId})
        .then(() => res.redirect('/'));
});

app.post('/api/review/:reviewId/downvote', (req, res) => {
    Vote
        .create({action: 'dislike', reviewId: req.params.reviewId})
        .then(() => res.redirect('/'));
});


app.get('/', (req, res) => {
    Review
        .findAll({ include: [Vote, Comment, User] })
        .then((reviews) => {
        res.render('homepage', { reviews, user: req.user });
    });
});

app.get('/api/createreview', (req, res) => {
    if(req.user){
        res.render('createReview', { user: req.user })
    }

    else{
        res.render('createreview', { user: req.user })
    }
});

app.post('/api/createreview', (req, res) => {
    if(req.user){
    const game = req.body.game;
    const note = req.body.note;
    const content = req.body.content;
    const user = req.user;
    Review
        .create({
            game: game,
            note: note,
            content: content,
            userId: user.id
        })
        .then(() => {
        res.redirect('/');
    })
        .catch((error) =>{
            res.render('500', {error: error})
        });
    }
    else{
        res.redirect('/api/login')
    }
});

app.get('/api/login', (req, res) => {
    // Render the login page
    res.render('login');
});

app.post('/api/login',
    // Authenticate user when the login form is submitted
    passport.authenticate('local', {
        // If authentication succeeded, redirect to the home page
        successRedirect: '/',
        // If authentication failed, redirect to the login page
        failureRedirect: '/api/login'
    })
);

db
    .sync()
    .then(() =>{
    app.listen(3000, () => {
    console.log('Listening on port 3000');
});
});