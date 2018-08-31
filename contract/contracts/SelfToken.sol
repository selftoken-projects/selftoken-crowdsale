pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

/**
 * @title 
 * @dev ERC20 Token, with the addition of symbol, name and decimals and an initial supply
 */
contract SelfToken is StandardToken, Pausable {
    using SafeMath for uint256;
}
