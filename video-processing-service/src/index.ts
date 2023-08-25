import express from "express";
import ffmpeg from "fluent-ffmpeg"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import { convertVideo, deleteProcessedVideo, deleteRawVideo, downloadRawVideo, setupDirectories, uploadProcessedVideo } from "./storage";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
setupDirectories();

const app = express();
app.use(express.json());

app.post("/process-video", async (req,res) => {
  // Get the bucket and filename from the Cloud Pub/Sub message
  let data;
  try {
    const message = Buffer.from(req.body.data, 'base64').toString('utf8');
    data = JSON.parse(message);
    if (!data.name) {
      throw new Error('Invalid message payload received');
    }
  } catch (error){
    console.log(error);
    return res.status(400).send("Bad Request: Missing filename.")
  }
  
  const inputFileName = data.name;
  const outputFileName = `processed-${inputFileName}`;
  
  // Download the raw video from Cloud Storage
  await downloadRawVideo(inputFileName)

  // Convert the video to 360p
  try{
    await convertVideo(inputFileName,outputFileName);
  } catch (err) {
    await Promise.all([
    deleteRawVideo(inputFileName),
    deleteProcessedVideo(outputFileName)
    ]);
    console.error(err)
    return res.status(500).send("Internal Error: video processing failed.")
  }

  // Upload the process video to Cloud Storage 
  await uploadProcessedVideo(outputFileName);
  await Promise.all([
    deleteRawVideo(inputFileName),
    deleteProcessedVideo(outputFileName)
    ]);

    return res.status(200).send("Processing Finsished");
})

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Video processing listen at http://localhost:${port}`)
});

