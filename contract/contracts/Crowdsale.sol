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
    uint raisedWei; // how many weis has been raised
    uint referalBonusPercentage = 5; // 5%
    uint256 public openingTime;
    uint256 public closingTime;
    uint minPurchaseWei = 0.1 ether;

    uint256 public hardTop; // how many eth can be recieved in this contract
    mapping(address=>uint) tokenBalances;  // Dummy balances ledger for user
 


    constructor (address tokenContractAddr, address _account, uint price, uint _openingTime, uint _closingTime) public {
        tokenContract = ERC20(tokenContractAddr);
        account = _account;
        priceInWei = price;
        openingTime = _openingTime;
        closingTime = _closingTime;
        hardTop = 10000 ether;
        raisedWei = 0;
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

    //? emit event
    function setHardtop (uint _hardTop) public onlyOwner {
        hardTop = _hardTop;
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

        raisedWei = raisedWei.add(msg.value);
        require(raisedWei <= hardTop);
        
        require(msg.value >= minPurchaseWei);
        
        bool validReferer = tokenContract.balanceOf(referer) > 0 && (referer != msg.sender);

        uint base = msg.value.div(priceInWei);
        uint bonus = base.mul(referalBonusPercentage).div(100);

        uint totalToken = validReferer ? base.add(bonus).add(bonus) : base.add(bonus);
        require(salableTokenAmount() >= totalToken);

        if (validReferer) {
            tokenBalances[msg.sender] = tokenBalances[msg.sender].add(base);
            tokenBalances[referer] = tokenBalances[referer].add(base);
        } else {
            tokenBalances[msg.sender] = tokenBalances[msg.sender].add(base.add(bonus));
        }
    }

    function withDrawEther (uint amount) public onlyOwner {
        msg.sender.transfer(amount);
    }
}
