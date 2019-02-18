import {sleepAwait} from "../sleep";
import {values, max, isNil, isString, assign} from "lodash";
import * as moment from "moment";
import * as phantom from "phantom";


(async function (config?: { viewportSize?: { width: number, height: number } }) {
    const instance = await phantom.create();
    const page = await instance.createPage();
    await page.on('onResourceRequested', function (requestData) {
        console.info('Requesting', requestData.url);
    });

    await page.property('viewportSize', assign(
        {
            width: 1920,
            height: 1080
        },
        config && config.viewportSize
    ));
    let viewportSize = await page.property('viewportSize');

    const status = await page.open(
        'https://mp.weixin.qq.com/s/MyvB-mMa0VF0pl_OxKcwIA'
    );
    const content = await page.property('content');
    console.log("status", status);
    // console.log("content", content);


    const getPageHeight = async () => {
        let hList = JSON.parse(await page.evaluate(function () {
            return JSON.stringify({
                "document.body.scrollHeight": document.body.scrollHeight,
                "document.body.offsetHeight": document.body.offsetHeight,
                "document.documentElement.clientHeight": document.documentElement.clientHeight,
                "document.documentElement.scrollHeight": document.documentElement.scrollHeight
            }, undefined, 4);
        }));
        // console.log(hList);
        // console.log(values(hList));
        // console.log(max(values(hList)));
        return max(values(hList));
    };

    let pageScrollH = viewportSize.height / 2;
    const pageScroll = async (i) => {
        let h = await  getPageHeight();
        if (pageScrollH * i + viewportSize.height < h) {
            await sleepAwait(1000);
            await page.property('scrollPosition', {
                left: 0,
                top: pageScrollH * i
            });
            await pageScroll(i + 1);
        }
    };
    await pageScroll(0);
    await sleepAwait(2 * 1000);
    await page.property('scrollPosition', {
        left: 0,
        top: 0
    });


    let bPDF = await page.renderBase64('pdf');
    let bPNG = await page.renderBase64('png');

    console.log(isNil(bPDF));
    console.log(isString(bPDF));
    console.log(bPDF.length);
    console.log(isNil(bPNG));
    console.log(isString(bPNG));
    console.log(bPNG.length);

    const fileName = moment().format('YYYY_MM_DD_HH_mm_ss_SSS');
    await page.render(fileName + '.pdf');
    await page.render(fileName + '.png');

    await instance.exit();
})();
