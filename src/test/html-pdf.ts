var pdf = require('html-pdf');
var options = {format: 'Letter'};

pdf.create(
    'https://mp.weixin.qq.com/s/MyvB-mMa0VF0pl_OxKcwIA'
    , options
).toFile('2.pdf', function (err, res) {
    if (err) return console.log(err);
    console.log(res);
});

