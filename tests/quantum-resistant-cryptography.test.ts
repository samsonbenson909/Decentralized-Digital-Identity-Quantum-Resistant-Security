import { describe, it, expect, beforeEach } from "vitest"

describe("Quantum-Resistant Cryptography Contract", () => {
  let contract
  let owner
  let user1
  let user2
  
  beforeEach(() => {
    owner = "SP1OWNER123456789"
    user1 = "SP2USER1234567890"
    user2 = "SP3USER2345678901"
    
    // Initialize contract with supported algorithms
    contract = {
      contractOwner: owner,
      supportedAlgorithms: new Map([
        [
          "CRYSTALS-Dilithium",
          {
            securityLevel: 3,
            keySize: 1952,
            signatureSize: 3293,
            status: "active",
            nistApproved: true,
          },
        ],
        [
          "FALCON",
          {
            securityLevel: 5,
            keySize: 1793,
            signatureSize: 666,
            status: "active",
            nistApproved: true,
          },
        ],
      ]),
      userQuantumKeys: new Map(),
      algorithmMetrics: new Map(),
    }
  })
  
  describe("Algorithm Management", () => {
    it("should verify NIST-approved algorithms", () => {
      expect(isAlgorithmApproved(contract, "CRYSTALS-Dilithium")).toBe(true)
      expect(isAlgorithmApproved(contract, "FALCON")).toBe(true)
    })
    
    it("should reject non-approved algorithms", () => {
      // Add deprecated algorithm
      contract.supportedAlgorithms.set("OLD-RSA", {
        securityLevel: 1,
        keySize: 2048,
        signatureSize: 256,
        status: "deprecated",
        nistApproved: false,
      })
      
      expect(isAlgorithmApproved(contract, "OLD-RSA")).toBe(false)
    })
    
    it("should allow owner to add new algorithms", () => {
      const result = addAlgorithm(contract, owner, "SPHINCS+", 4, 32, 17088, true)
      
      expect(result.success).toBe(true)
      expect(contract.supportedAlgorithms.has("SPHINCS+")).toBe(true)
      
      const algorithm = contract.supportedAlgorithms.get("SPHINCS+")
      expect(algorithm.nistApproved).toBe(true)
      expect(algorithm.status).toBe("active")
    })
    
    it("should reject algorithm addition from non-owner", () => {
      const result = addAlgorithm(contract, user1, "UNAUTHORIZED-ALGO", 1, 128, 64, false)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
    
    it("should allow owner to deprecate algorithms", () => {
      const result = deprecateAlgorithm(contract, owner, "CRYSTALS-Dilithium")
      
      expect(result.success).toBe(true)
      
      const algorithm = contract.supportedAlgorithms.get("CRYSTALS-Dilithium")
      expect(algorithm.status).toBe("deprecated")
      expect(isAlgorithmApproved(contract, "CRYSTALS-Dilithium")).toBe(false)
    })
  })
  
  describe("Quantum Key Registration", () => {
    it("should register quantum-safe keys for users", () => {
      const keyId = "user-key-001"
      const publicKeyHash = new Uint8Array(32).fill(0x88)
      const algorithm = "CRYSTALS-Dilithium"
      const validityPeriod = 52560 // ~1 year
      
      const result = registerQuantumKey(contract, user1, keyId, publicKeyHash, algorithm, validityPeriod)
      
      expect(result.success).toBe(true)
      
      const userKey = getUserKey(contract, user1, keyId)
      expect(userKey).toBeDefined()
      expect(userKey.algorithm).toBe(algorithm)
      expect(userKey.usageCount).toBe(0)
    })
    
    it("should reject keys with unapproved algorithms", () => {
      const result = registerQuantumKey(
          contract,
          user1,
          "bad-key",
          new Uint8Array(32).fill(0x99),
          "UNAPPROVED-ALGO",
          52560,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_ALGORITHM")
    })
    
    it("should prevent duplicate key registration", () => {
      const keyId = "duplicate-key"
      const publicKeyHash = new Uint8Array(32).fill(0xaa)
      const algorithm = "FALCON"
      
      // First registration
      registerQuantumKey(contract, user1, keyId, publicKeyHash, algorithm, 52560)
      
      // Attempt duplicate
      const result = registerQuantumKey(contract, user1, keyId, new Uint8Array(32).fill(0xbb), algorithm, 52560)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
  })
  
  describe("Key Usage Tracking", () => {
    beforeEach(() => {
      registerQuantumKey(contract, user1, "usage-key", new Uint8Array(32).fill(0xcc), "CRYSTALS-Dilithium", 52560)
    })
    
    it("should increment key usage count", () => {
      const result = incrementKeyUsage(contract, user1, "usage-key")
      
      expect(result.success).toBe(true)
      
      const userKey = getUserKey(contract, user1, "usage-key")
      expect(userKey.usageCount).toBe(1)
    })
    
    it("should handle multiple usage increments", () => {
      incrementKeyUsage(contract, user1, "usage-key")
      incrementKeyUsage(contract, user1, "usage-key")
      incrementKeyUsage(contract, user1, "usage-key")
      
      const userKey = getUserKey(contract, user1, "usage-key")
      expect(userKey.usageCount).toBe(3)
    })
    
    it("should reject usage increment for non-existent key", () => {
      const result = incrementKeyUsage(contract, user1, "non-existent-key")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_KEY_NOT_FOUND")
    })
    
    it("should reject usage increment from wrong user", () => {
      const result = incrementKeyUsage(contract, user2, "usage-key")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_KEY_NOT_FOUND")
    })
  })
  
  describe("Algorithm Information Retrieval", () => {
    it("should retrieve algorithm information", () => {
      const algorithmInfo = getAlgorithmInfo(contract, "CRYSTALS-Dilithium")
      
      expect(algorithmInfo).toBeDefined()
      expect(algorithmInfo.securityLevel).toBe(3)
      expect(algorithmInfo.keySize).toBe(1952)
      expect(algorithmInfo.signatureSize).toBe(3293)
      expect(algorithmInfo.nistApproved).toBe(true)
    })
    
    it("should return undefined for non-existent algorithms", () => {
      const algorithmInfo = getAlgorithmInfo(contract, "NON-EXISTENT")
      expect(algorithmInfo).toBeUndefined()
    })
    
    it("should retrieve algorithm metrics", () => {
      // Set up mock metrics
      contract.algorithmMetrics.set("FALCON", {
        verificationTime: 150,
        keyGenerationTime: 300,
        signatureTime: 200,
      })
      
      const metrics = getAlgorithmMetrics(contract, "FALCON")
      
      expect(metrics).toBeDefined()
      expect(metrics.verificationTime).toBe(150)
      expect(metrics.keyGenerationTime).toBe(300)
      expect(metrics.signatureTime).toBe(200)
    })
  })
  
  describe("Key Expiration Handling", () => {
    
    it("should validate key before usage increment", () => {
      const currentBlock = 2000
      
      // Register key with past expiry
      const keyData = {
        publicKeyHash: new Uint8Array(32).fill(0xee),
        algorithm: "CRYSTALS-Dilithium",
        creationDate: 1000,
        expiryDate: 1500, // Expired
        usageCount: 0,
      }
      
      contract.userQuantumKeys.set(`${user1}:expired-key`, keyData)
      
      const isValid = isKeyValid(contract, user1, "expired-key", currentBlock)
      expect(isValid).toBe(false)
    })
  })
})

// Mock contract functions
function isAlgorithmApproved(contract, algorithmName) {
  const algorithm = contract.supportedAlgorithms.get(algorithmName)
  return algorithm && algorithm.nistApproved && algorithm.status === "active"
}

function addAlgorithm(contract, caller, algorithmName, securityLevel, keySize, signatureSize, nistApproved) {
  if (caller !== contract.contractOwner) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  contract.supportedAlgorithms.set(algorithmName, {
    securityLevel,
    keySize,
    signatureSize,
    status: "active",
    nistApproved,
  })
  
  return { success: true }
}

function deprecateAlgorithm(contract, caller, algorithmName) {
  if (caller !== contract.contractOwner) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const algorithm = contract.supportedAlgorithms.get(algorithmName)
  if (algorithm) {
    algorithm.status = "deprecated"
    contract.supportedAlgorithms.set(algorithmName, algorithm)
  }
  
  return { success: true }
}

function registerQuantumKey(contract, caller, keyId, publicKeyHash, algorithm, validityPeriod) {
  if (!isAlgorithmApproved(contract, algorithm)) {
    return { success: false, error: "ERR_INVALID_ALGORITHM" }
  }
  
  const keyIdentifier = `${caller}:${keyId}`
  if (contract.userQuantumKeys.has(keyIdentifier)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const currentBlock = 2000 // Mock current block
  const keyData = {
    publicKeyHash,
    algorithm,
    creationDate: currentBlock,
    expiryDate: currentBlock + validityPeriod,
    usageCount: 0,
  }
  
  contract.userQuantumKeys.set(keyIdentifier, keyData)
  return { success: true }
}

function getUserKey(contract, userId, keyId) {
  return contract.userQuantumKeys.get(`${userId}:${keyId}`)
}

function incrementKeyUsage(contract, caller, keyId) {
  const keyIdentifier = `${caller}:${keyId}`
  const keyData = contract.userQuantumKeys.get(keyIdentifier)
  
  if (!keyData) {
    return { success: false, error: "ERR_KEY_NOT_FOUND" }
  }
  
  keyData.usageCount += 1
  contract.userQuantumKeys.set(keyIdentifier, keyData)
  
  return { success: true }
}

function getAlgorithmInfo(contract, algorithmName) {
  return contract.supportedAlgorithms.get(algorithmName)
}

function getAlgorithmMetrics(contract, algorithmName) {
  return contract.algorithmMetrics.get(algorithmName)
}

function isKeyValid(contract, userId, keyId, currentBlock) {
  const keyData = getUserKey(contract, userId, keyId)
  return keyData && keyData.expiryDate > currentBlock
}
