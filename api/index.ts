var express = require('express');
var app = express();

// memory setup
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));

// parser setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cors setup
const cors = require('cors');
app.use(cors());

// storage setup
const multer = require('multer');
const upload = multer();

// google api setup
const stream = require('stream');
const { google } = require('googleapis');

const keyFilePath = `${process.cwd()}/public/googleApiCredential.json`;
const scopes = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: scopes
});

const drive = google.drive({ version: 'v3', auth });

// main directory
const directory = '1QVIIvxHWTfzyHXQ1SEfRdK9XiutbfDII';

// get methods
app.get('/', (req, res) => {
  res.send('Back Furry! Why You on Here?');
})

app.get('/list', async (req, res) => {
  const { data } = await drive.files.list();
  res.send(data.files);
})

app.get('/deleteall', async (req, res) => {
  const deleteFiles = () => {
    return new Promise(async (resolve) => {
      const { data } = await drive.files.list({
        q: 'not name = "furfurry"'
      }).catch(err => console.log(err));

      const files = data.files;

      files.map(({ id }) => {
        drive.files.delete({ fileId: id });
      }).catch(err => console.log(err));

      resolve(true);
    });
  }

  await deleteFiles();

  res.send('done');
})

// post methods
app.post('/search', async (req, res) => {
  const { postName } = req.body;
  let list;
  
  list = await drive.files.list({
    q: `"${directory}" in parents`
  }).catch(err => console.log(err)) || [];

  list = list.data.files.filter(({ name }) => name.replace(/ /g, '').toLowerCase().includes(postName.toLowerCase()));
  
  res.send(list);
})

app.post('/getPost', async (req, res) => {
  const { postId } = req.body;
  let files;

  files = await drive.files.list({
    q: `"${postId}" in parents`
  }).catch(err => console.log(err)) || [];

  res.send(files.data.files);
})

app.post('/getFile', async (req, res) => {
  const { fileId } = req.body;
  let file;

  file = await drive.files.get({
    fileId: fileId
  }).catch(err => console.log(err)) || [];

  res.send(file);
})

app.post('/createDirectory', async (req, res) => {
  const { title } = req.body;

  const driveDirectory = await drive.files.create({
    requestBody: {
      name: `${title}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [`${directory}`]
    },
    fields: 'id, name'
  }).catch(err => console.log(err)) || [];

  res.send(driveDirectory);
})

app.post('/post', upload.any(), async (req, res) => {
  const { files } = req;
  const { id, content } = req.body;

  let postFiles = true;
  let postContent = true;
  let postComment = true;

  for (let file of files) {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    await drive.files.create({
      media: {
        mimeType: file.mimeType,
        body: bufferStream
      },
      requestBody: {
        name: file.originalname,
        parents: [`${id}`]
      },
      fields: 'id, name'
    }).catch(() => postFiles = false);
  }

  if (postFiles) {
    await drive.files.create({
      media: {
        mimeType: 'text/plain',
        body: `${content}`
      },
      requestBody: {
        name: 'content.txt',
        parents: [`${id}`]
      },
      fields: 'id, name'
    }).catch(() => postContent = false);

    await drive.files.create({
      media: {
        mimeType: 'text/plain',
        body: ''
      },
      requestBody: {
        name: 'comments.txt',
        parents: [`${id}`]
      },
      fileds: 'id, name'
    }).catch(() => postComment = false);
  }

  if (postFiles && postContent && postComment) {
    res.send('Success');
  }
  else {
    console.log(postFiles, postContent, postComment);
    res.send('Failed');
  }
})

app.post('/updateComment', async (req, res) => {
  const { fileId, comment } = req.body;
  let updateComment = true;

  await drive.files.update({
    fileId: `${fileId}`,
    media: {
      mimeType: 'text/plain',
      body: comment
    },
    fileds: 'id, name'
  }).catch(() => updateComment = false);

  if (updateComment) {
    res.send('Success');
  }
  else {
    res.status(500).send('Failed');
  }
})

module.exports = app;