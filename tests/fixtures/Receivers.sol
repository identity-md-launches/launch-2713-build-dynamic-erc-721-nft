// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ICompanion {
    function mint() external;
}

contract ReenterReceiver {
    function mint(address target) external {
        ICompanion(target).mint();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        (bool ok,) = msg.sender.call(abi.encodeWithSignature("mint()"));
        require(!ok, "reentrant mint succeeded");
        return this.onERC721Received.selector;
    }
}

contract RejectReceiver {
    function mint(address target) external {
        ICompanion(target).mint();
    }
}

contract MockCore {
    struct CoreState {
        uint64 settledThroughRound;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint64 blockHeight;
        uint96 blockProgress;
        uint32 workPerThousandBlocks;
        uint256 authorizationNonce;
        bool paused;
    }
    CoreState private _state;
    bool private _broken;

    function set(uint64 height, uint96 progress, bool inconsistent, bool broken) external {
        _state.blockHeight = height;
        _state.blockProgress = progress;
        _state.cumulativeBlockUnits = uint96(uint256(height) * 1_000_000_000 + progress + (inconsistent ? 1 : 0));
        _broken = broken;
    }

    function state() external view returns (CoreState memory) {
        require(!_broken, "upstream unavailable");
        return _state;
    }
}
