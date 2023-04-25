const express = require("express");
const mysql = require('mysql');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const pool = dbConnection();

const saltRounds = 10;

var name;

var loggedIn = false;
//those this have to generated 
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true }
}))

app.set("view engine", "ejs");
app.use(express.static("public"));
//to parse Form data sent using POST method
app.use(express.urlencoded({extended: true}));

//routes
app.get('/', (req, res) => {
   res.render('LandingPage')
});



app.get('/SignUp', (req, res) => {
   res.render('SignUp')
});


app.post('/SignUp', (req, res) => {
  let firstname = req.body.firstname;
  let lastname = req.body.lastname;
  let username = req.body.username;
  let password = req.body.password;

 //this is how we encrypt the password for signups
const salt = bcrypt.genSaltSync(saltRounds);
const hash = bcrypt.hashSync(password, salt);
  
    let sql = `INSERT INTO new_accounts
              (Firstname, Lastname, Username, Password)
              VALUES
              (?,?,?,?)`
  
    let params = [firstname, lastname, username, hash];

   executeSQL(sql, params);
  

   res.render('Login');
});



app.get('/Login', (req, res) => {
   res.render('Login')
});



app.post ('/Login', async (req, res) => {
  //because we are using post we need to req the username from the body.
  let username = req.body.username;
  let password = req.body.password;
  
  name=username;
  
  //I created a test user: username:testuser
  //let plainTextPwd = "testuser123";
  
  let passwordHash = "";

   let sql = `SELECT *
             FROM new_accounts
             WHERE Username=?`;

   let rows = await executeSQL(sql,[username]);

   //username exist in database
   //greater than 0 means there is something in the rows array
  
  //our naming convention for database fields start with capital letter.
 
  
   if(rows.length > 0){
     passwordHash = rows[0].Password;
   }
  
  const match = await bcrypt.compare(password, passwordHash);

  //match would be true if they match, 
  //if match is true then welcome
  
  if(match){
    //only for one user, one session per user
    req.session.loggedIn = true;
    res.render('Home')
  }else{
    
    res.render('Login', {"error": "Wrong credentials"})
  }
  
   
});


function isAuthenticated (req, res, next){
   if(req.session.loggedIn){
    next();
  }else{
    res.render('Login')
  }
}
app.get('/Home',isAuthenticated, async (req, res, ) => {
    
   res.render('Home')

});

app.get('/Search',isAuthenticated, async (req, res, ) => {
 
    let url = `https://www.themealdb.com/api/json/v1/1/search.php?s=Arrabiata`
    
   let response = await fetch(url);
    
   let data = await response.json();

   res.render('Search', {"data": data})

});


app.get('/Results',isAuthenticated, async (req, res) => {
   let searchTerm = req.query.search;
 
   let url = `https://api.spoonacular.com/recipes/search?apiKey=86f309cb7a444855af66e1fbb563696c&number=5&query=${searchTerm}`
    
   let response = await fetch(url);
    
   let data = await response.json();

   // shuffle(data);
    
   res.render('Results', {"data": data})
   
   
   
});

app.get('/Favorites',isAuthenticated, async (req, res) => {
  
  let sql = `SELECT UserID
             FROM new_accounts
             WHERE Username=?`;
  
  
  let params = [name];
  let rows1 = await executeSQL(sql,params);
  userid=rows1[0].UserID;

      sql = `SELECT RecipeID,Recipename, Preptime, Recipeimg,                Recipeinstr
            FROM favorites
            WHERE UserID=?
            ORDER by Recipename`
  
  let params2 = [userid];
  let rows2 = await executeSQL(sql,params2);
  

   res.render('Favorites', {"Favoritedata": rows2})
});

app.post('/Favorites',isAuthenticated, async (req, res) => {
  // get this information from results
  let recipename = req.body.RecipeN;
  let preptime = req.body.Time;
  let recipeimage ="https://spoonacular.com/recipeImages/"+req.     
                    body.Recipeimg;
  let recipeinstructions = req.body.Recipeinstructions;
  

   let sql = `SELECT UserID
             FROM new_accounts
             WHERE Username=?`;
  
  
  let params = [name];
  let rows1 = await executeSQL(sql,params);
  userid=rows1[0].UserID;

  sql = `INSERT INTO favorites
        (Recipename, Preptime, UserID, Recipeimg, Recipeinstr)
        VALUES
        (?,?,?,?,?)`

  let params2 = [recipename, preptime, userid, recipeimage, recipeinstructions];
  
  let rows2 = await executeSQL(sql,params2);
  
  
  res.redirect('Favorites');
});

app.get('/Review',isAuthenticated, (req, res) => {
  
  let rating = req.body.rating;
  let comments = req.body.comments;
  let recipeName = req.body.recipeName;

    
  
  res.render('Review');
});

app.post('/Review', isAuthenticated, async  (req, res) => {

  let rating = req.body.rating;
  let comments = req.body.comments;
  let recipeName = req.body.recipeName;
  
  let sql = `SELECT UserID
             FROM new_accounts
             WHERE Username=?`;
  
  let params = [name];
  let rows = await executeSQL(sql,params);
  userid=rows[0].UserID;

  sql = `SELECT RecipeId
        From favorites
        WHERE Recipename=?`

  let params2 = [recipeName];
  let rows2 = await executeSQL(sql,params2);
  recipeid=rows2[0].RecipeId;

  sql = `INSERT INTO reviews
        (RecipeID, UserID, Reviewtext, Reviewrating)
        VALUES
        (?, ?, ?, ?)`

  let params3 = [recipeid, userid, comments, rating];
  let rows3 = await executeSQL(sql,params3);

    res.render('Home');
});


app.get('/allReviews', isAuthenticated, async (req, res) => {

  let sql = `SELECT UserID
             FROM new_accounts
             WHERE Username=?`;
  let params = [name];
  let rows1 = await executeSQL(sql,params);
  userid=rows1[0].UserID;

  
  
  sql = `SELECT Reviewrating, Reviewtext, RecipeID 
            FROM reviews
            WHERE UserID=?`;
  let params2 = [userid];         
  
  let rows = await executeSQL(sql, params2);

  
  res.render('allReviews',{"allReviews":rows})
});

app.get('/updateReview', isAuthenticated, async (req, res) => {

  let rid = req.query.id;
  
  let sql = `SELECT UserID
             FROM new_accounts
             WHERE Username=?`;
  
  let params = [name];
  let rows1 = await executeSQL(sql,params);
  userid=rows1[0].UserID;

  sql = `SELECT Reviewrating, Reviewtext, RecipeID
         FROM reviews
        WHERE UserID = ? AND RecipeID=?`;

    
  let params1 = [userid, rid];
  let rows = await executeSQL(sql,params1);
    
   
   res.render('updateReview', {"allReviews": rows});

  
});
app.post('/updateReview', isAuthenticated, async (req, res) => {
    
   let sql = `SELECT UserID
             FROM new_accounts
             WHERE Username=?`;
  let params = [name];
  let rows1 = await executeSQL(sql,params);
  userid=rows1[0].UserID;
    
  let review = req.body.review;
  let reId = req.body.reId;
  let rate = req.body.rating;


    
  sql = `UPDATE reviews
             SET
                Reviewtext = ?,
                Reviewrating = ?
            WHERE
                 RecipeID  = ? AND UserID = ?`;
    
  let params1 = [review, rate, reId, userid];
  let rows = await executeSQL(sql,params1);

  
    
  res.render('Home');

  
});

app.get("/dbTest", async function(req, res){
let sql = "SELECT CURDATE()";
let rows = await executeSQL(sql);
res.send(rows);
});//dbTest

//functions
async function executeSQL(sql, params){
return new Promise (function (resolve, reject) {
pool.query(sql, params, function (err, rows, fields) {
if (err) throw err;
   resolve(rows);
});
});
}//executeSQL
//values in red must be updated
function dbConnection(){

   const pool  = mysql.createPool({
      connectionLimit: 10,
      host: "eanl4i1omny740jw.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
      user: "hpzq1nrt7m1555ee",
      password: "u9i64guqx3tz9wqz",
      database: "dpapzg6ss8cinzfo"

   }); 

   return pool;

} //dbConnection

//start server
app.listen(3000, () => {
console.log("Expresss server running...")
} )