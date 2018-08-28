pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/*
Doc:
https://docs.google.com/document/d/1Fe5MQ0NLFEhHXhliSfrTid194W1rqSQzx1e-kjpeoLQ/edit#

Prerequisites:
1. An ERC20 contract is deployed
2. An account A is granted at least the salable tokens
3. The Crowdsale contract is deployed at address C
4. The account A approve()s C of the salable amount
*/
contract Crowdsale is Ownable {
    using SafeMath for uint;

    ERC20 tokenContract;
    address account; // the account holding the crowdsale tokens

    uint priceInWei; // how many weis for one token
    uint referalBonusPercentage = 5; // 5%
    uint256 public openingTime;
    uint256 public closingTime;
    uint minPurchaseWei = 0.1 ether;

    constructor (address tokenContractAddr, address _account, uint price, uint _openingTime, uint _closingTime) public {
        tokenContract = ERC20(tokenContractAddr);
        account = _account;
        priceInWei = price;
        openingTime = _openingTime;
        closingTime = _closingTime;
    }

    modifier onlyWhileOpen {
        require(block.timestamp >= openingTime && block.timestamp <= closingTime);
        _;
    }

    function salableTokenAmount () public view returns (uint) {
        return tokenContract.allowance(account, address(this));
    }

    //? emit event
    function setPrice (uint price) public onlyOwner {
        priceInWei = price;
    }

    function setReferalBonusPercentage (uint n) public onlyOwner {
        referalBonusPercentage = n;
    }

    function setOpeningTime (uint time) public onlyOwner {
        openingTime = time;
    }

    function setClosingTime (uint time) public onlyOwner {
        closingTime = time;
    }

    function setMinPurchase (uint n) public onlyOwner {
        minPurchaseWei = n;
    }

    function purchase (address referer) public payable onlyWhileOpen {
        require(msg.value > minPurchaseWei);
        
        bool validReferer = tokenContract.balanceOf(referer) > 0;

        uint base = msg.value.div(priceInWei);
        uint bonus = base.mul(referalBonusPercentage).div(100);

        uint totalToken = validReferer ? base.add(bonus).add(bonus) : base.add(bonus);
        require(salableTokenAmount() > totalToken);

        tokenContract.transferFrom(account, msg.sender, base.add(bonus));
        
        if (validReferer) {
            tokenContract.transferFrom(account, referer, bonus);
        }
    }

    function withDrawEther (uint amount) public onlyOwner {
        msg.sender.transfer(amount);
    }
}
