const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");
const fs = require("fs");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function upload(file) {
  const form = new FormData();
  form.append("file", fs.createReadStream(file));

  const res = await axios.post(
    "https://cdnzero.unaux.com/api/upload.php",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Referer: "https://cdnzero.unaux.com/",
      },
    }
  );

  await sleep(2000);

  const $ = cheerio.load(res.data);
  let link = $("#directLink").val() || $("#directLink").attr("value");

  if (!link) return null;

  return link;
}

upload("./gambar.png").then(console.log);