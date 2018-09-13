const { assertRevert } = require("./helper/assertRevert");
const { ether } = require("./helper/ether");
const { expectThrow } = require("./helper/expectThrow");
const { latestTime } = require("./helper/latestTime");
const { increaseTime, increaseTimeTo } = require("./helper/increaseTime");
const Crowdsale = artifacts.require("Crowdsale");


const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const rate = new BigNumber(3600);
const minTokensPurchased = ether(200);
const referSenderBonusPercentage = new BigNumber(5);
const referReceiverBonusPercentage = new BigNumber(5);
const pioneerBonusPerStage = ether(45000);
const pioneerWeiThreshold = ether(1);
const maxStages = new BigNumber(10);
const weiRaisedPerStage = ether(1000);
const hardCap = ether(10000);

const timestep = 86400;
const openingTime = Math.round(Date.now()/1000);
const closingTime = openingTime + timestep * 2;
const pioneerTimeEnd = openingTime + timestep;

let crowdsale;

let weis = new BigNumber(0);
let tokens = new BigNumber(0);
let totalWeis = new BigNumber(0);
let totalTokens = new BigNumber(0);


contract('Crowdsale', function (accounts) {
    const [owner, buyer1, buyer2, buyer3, anyone] = accounts;

    context('test rules of becoming a pioneer', function () {
        it("should deploy new contract", async function () {
            crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
        });

        /* [Begin State]
         * crowdsale deployed
         * no pioneer
        */
        it("should have no pioneers at first", async function () {
            assert.equal(await crowdsale.isPioneer(owner), false);
            assert.equal(await crowdsale.isPioneer(buyer1), false);
            assert.equal(await crowdsale.isPioneer(anyone), false);
        });

        /* [Begin State]
         * crowdsale deployed
         * no pioneer
        */
        it("should be a pioneer after paying >= pioneerWeiThreshold", async function () {
            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: pioneerWeiThreshold});
            assert.equal(await crowdsale.isPioneer(buyer1), true);
        });

        /* [Begin State]
         * crowdsale deployed
         * pioneer:
         * - buyer1
        */
        it("should not be a pioneer after paying (pioneerWeiThreshold / 2)", async function () {
            await crowdsale.purchaseTokens(anyone, {from: buyer2, value: pioneerWeiThreshold.dividedToIntegerBy(2)});
            assert.equal(await crowdsale.isPioneer(buyer2), false);
        });

        /* [Begin State]
         * crowdsale deployed
         * pioneer:
         * - buyer1
        */
        it("should become a pioneer after paying (pioneerWeiThreshold / 2) twice", async function () {
            await crowdsale.purchaseTokens(anyone, {from: buyer2, value: pioneerWeiThreshold.dividedToIntegerBy(2)});
            assert.equal(await crowdsale.isPioneer(buyer2), true);
        });

        /* [Begin State]
         * crowdsale deployed
         * pioneer:
         * - buyer1
         * - buyer2
        */
        it("should not be a pioneer after pioneerTimeEnd", async function () {
            // await crowdsale.setPioneerTimeEnd(latestTime+1, {from: owner});
            await increaseTimeTo(pioneerTimeEnd + 1);
            await crowdsale.purchaseTokens(anyone, {from: buyer3, value: pioneerWeiThreshold});
            assert.equal(await crowdsale.isPioneer(buyer3), false);

            assert.equal(await crowdsale.isPioneer(buyer1), true);
            assert.equal(await crowdsale.isPioneer(buyer2), true);
            assert.equal(await crowdsale.isPioneer(owner), false);
            assert.equal(await crowdsale.isPioneer(anyone), false);
        });
    });
});
