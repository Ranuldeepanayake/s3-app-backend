//Includes.
const express = require('express');
const bodyParser = require("body-parser");
const path= require('path');
const file = require('fs');

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

//////////////////////////////////////////////////////////////////////////
//For image uploads
////////////////////////////////////////////////////////////////////////// 
const multer  = require('multer');
const uploadImageMulter = multer({ dest: './temp' });
//////////////////////////////////////////////////////////////////////////

const bcrypt = require('bcrypt');	//For hashing passwords.
const saltRounds = 2;	//Number of salt rounds for hashing.

var session = require('express-session');
const cookieParser = require("cookie-parser");
const { Session } = require('express-session');
const { serialize } = require('v8');
const { error } = require('console');
const { resolve } = require('path');
const { render } = require('ejs');

//Global constants.
const app = express();
const port = 3000;

//Path preparation.
const htmlPath= path.join(__dirname, '/html/');
const imagePath= path.join(__dirname, '/temp/'); 

app.use(express.static(__dirname + '/html/'));	//Use Ranga's static resources.
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs')


//S3 resources.
// Set up AWS credentials
const s3Client = new S3Client({
	region: 'ap-southeast-1',
	credentials: {
	  accessKeyId: '',
	  secretAccessKey: '',
	},
  });

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Routes for serving the front end.
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/', function(req, res){
	//Check if user is logged in
	//Show all supplier data if user is not logged in.
	
	console.log("Rendering the form page>");
	res.render(htmlPath + 'index.ejs');

});

//This function processes adding an item.
app.post('/upload-image', uploadImageMulter.single('imageField'), function(req, res) {
	console.log("Form received!");
	// req.file is the name of your file in the form above, here 'uploaded_file'
	// req.body will hold the text fields, if there were any 
	console.log(req.file, req.body);

	//Handle other file types and limit the maximum file size.
	file.renameSync(imagePath + req.file.filename, imagePath + req.file.originalname);

	const fileStream = file.createReadStream(imagePath + req.file.originalname);

	const params = {
		Bucket: 's3-bucket-ranul-52d62b41-6ad9-c13a-b5b9-260b573152ba',
		Key: 's3-app/' + req.file.originalname,
		Body: fileStream
	};

	try {
		s3Client.send(new PutObjectCommand(params));
		console.log('File uploaded successfully');
		res.status(200).send('File uploaded');
	} catch (err) {
		console.error(err);
		res.status(500).send('Failed to upload file');
	}


	/* supplier.addItem(req.body, newItemImagePath + req.file.filename + '.jpg', session.userid, function(result){
		if(result == 'failure'){
			res.render('Edit-inventory.ejs', {userFName: req.session.firstName, itemDetails: result, message: 'fail'})
		} else{
			res.render('Edit-inventory.ejs', {userFName: req.session.firstName, itemDetails: result, message: 'Item Added Successfully!'})
		}
	}); */
});

//Handle invalid URLs.
app.all('*', function(req, res) {
    	res.send('Bad request');
});

//Starts a nodejs server instance.
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});