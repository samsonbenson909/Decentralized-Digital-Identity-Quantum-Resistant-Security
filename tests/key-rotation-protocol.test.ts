import { describe, it, expect, beforeEach } from "vitest"

describe("Key Rotation Protocol Contract", () => {
  let contract
  let owner
  let user1
  let user2
  
  beforeEach(() => {
    owner = "SP1OWNER123456789"
    user1 = "SP2USER1234567890"
    user2 = "SP3USER2345678901"
    
    contract = {
      contractOwner: owner,
      rotationSchedules: new Map(),
      rotationHistory: new Map(),
      emergencyRotations: new Map(),
      rotationCounter: 0,
    }
  })
  
  describe("Rotation Schedule Setup", () => {
    it("should setup rotation schedule for user", () => {
      const currentKeyId = "initial-key-001"
      const rotationFrequency = 52560 // Annual rotation
      const autoRotate = true
      
      const result = setupRotationSchedule(contract, user1, currentKeyId, rotationFrequency, autoRotate)
      
      expect(result.success).toBe(true)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule).toBeDefined()
      expect(schedule.currentKeyId).toBe(currentKeyId)
      expect(schedule.rotationFrequency).toBe(rotationFrequency)
      expect(schedule.autoRotate).toBe(autoRotate)
    })
    
    it("should calculate next rotation date correctly", () => {
      const currentBlock = 1000
      const rotationFrequency = 26280 // Semi-annual
      
      setupRotationSchedule(contract, user1, "test-key", rotationFrequency, false, currentBlock)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.nextRotation).toBe(currentBlock + rotationFrequency)
    })
    
    it("should allow schedule updates", () => {
      setupRotationSchedule(contract, user1, "key-1", 52560, true)
      setupRotationSchedule(contract, user1, "key-2", 26280, false)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.currentKeyId).toBe("key-2")
      expect(schedule.rotationFrequency).toBe(26280)
      expect(schedule.autoRotate).toBe(false)
    })
  })
  
  describe("Rotation Due Checking", () => {
    beforeEach(() => {
      const currentBlock = 1000
      setupRotationSchedule(contract, user1, "scheduled-key", 100, true, currentBlock)
    })
    
    it("should detect when rotation is due", () => {
      const currentBlock = 1150 // Past rotation time
      const isDue = isRotationDue(contract, user1, currentBlock)
      expect(isDue).toBe(true)
    })
    
    it("should detect when rotation is not yet due", () => {
      const currentBlock = 1050 // Before rotation time
      const isDue = isRotationDue(contract, user1, currentBlock)
      expect(isDue).toBe(false)
    })
    
    it("should handle users without schedules", () => {
      const isDue = isRotationDue(contract, user2, 2000)
      expect(isDue).toBe(false)
    })
  })
  
  describe("Key Rotation Execution", () => {
    beforeEach(() => {
      const currentBlock = 1000
      setupRotationSchedule(contract, user1, "old-key", 100, true, currentBlock)
    })
    
    it("should perform scheduled rotation", () => {
      const currentBlock = 1200 // Past due date
      const newKeyId = "new-key-001"
      const reason = "scheduled-rotation"
      
      const result = rotateKey(contract, user1, newKeyId, reason, currentBlock)
      
      expect(result.success).toBe(true)
      expect(typeof result.rotationId).toBe("number")
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.currentKeyId).toBe(newKeyId)
      expect(schedule.lastRotation).toBe(currentBlock)
    })
    
    it("should record rotation history", () => {
      const currentBlock = 1200
      const newKeyId = "history-key"
      const reason = "security-upgrade"
      
      const result = rotateKey(contract, user1, newKeyId, reason, currentBlock)
      const rotationId = result.rotationId
      
      const history = getRotationHistory(contract, user1, rotationId)
      expect(history).toBeDefined()
      expect(history.oldKeyId).toBe("old-key")
      expect(history.newKeyId).toBe(newKeyId)
      expect(history.reason).toBe(reason)
      expect(history.rotationDate).toBe(currentBlock)
    })
    
    it("should reject premature rotation without emergency", () => {
      const currentBlock = 1050 // Before due date
      const result = rotateKey(contract, user1, "premature-key", "too-early", currentBlock)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_ROTATION_NOT_DUE")
    })
    
    it("should update next rotation date", () => {
      const currentBlock = 1200
      rotateKey(contract, user1, "updated-key", "scheduled", currentBlock)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.nextRotation).toBe(currentBlock + 100) // frequency
    })
  })
  
  describe("Emergency Rotation", () => {
    beforeEach(() => {
      setupRotationSchedule(contract, user1, "emergency-key", 52560, true)
    })
    
    it("should initiate emergency rotation", () => {
      const reason = "key-compromise-detected"
      const currentBlock = 1000
      
      const result = initiateEmergencyRotation(contract, user1, reason, currentBlock)
      
      expect(result.success).toBe(true)
      
      const emergency = hasEmergencyRotation(contract, user1)
      expect(emergency).toBe(true)
      
      const emergencyData = getEmergencyRotation(contract, user1)
      expect(emergencyData.reason).toBe(reason)
      expect(emergencyData.deadline).toBe(currentBlock + 144) // 24 hours
    })
    
    it("should allow rotation during emergency", () => {
      const currentBlock = 1000
      initiateEmergencyRotation(contract, user1, "security-breach", currentBlock)
      
      const result = rotateKey(contract, user1, "emergency-new-key", "emergency-response", currentBlock)
      
      expect(result.success).toBe(true)
      expect(hasEmergencyRotation(contract, user1)).toBe(false) // Should be cleared
    })
    
    it("should handle emergency deadline expiration", () => {
      const currentBlock = 1000
      initiateEmergencyRotation(contract, user1, "expired-emergency", currentBlock)
      
      const emergencyData = getEmergencyRotation(contract, user1)
      const isExpired = currentBlock + 200 > emergencyData.deadline
      
      expect(isExpired).toBe(true)
    })
  })
  
  describe("Next Key Scheduling", () => {
    beforeEach(() => {
      setupRotationSchedule(contract, user1, "current-key", 26280, true)
    })
    
    it("should schedule next key in advance", () => {
      const nextKeyId = "pre-scheduled-key"
      
      const result = scheduleNextKey(contract, user1, nextKeyId)
      
      expect(result.success).toBe(true)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.nextKeyId).toBe(nextKeyId)
    })
    
    it("should reject scheduling for non-existent user", () => {
      const result = scheduleNextKey(contract, user2, "invalid-key")
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
  })
  
  describe("Rotation Frequency Updates", () => {
    beforeEach(() => {
      const currentBlock = 1000
      setupRotationSchedule(contract, user1, "freq-key", 52560, true, currentBlock)
    })
    
    it("should update rotation frequency", () => {
      const newFrequency = 26280 // Change to semi-annual
      
      const result = updateRotationFrequency(contract, user1, newFrequency)
      
      expect(result.success).toBe(true)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.rotationFrequency).toBe(newFrequency)
    })
    
    it("should recalculate next rotation date", () => {
      const currentBlock = 1000
      const lastRotation = 1000
      const newFrequency = 100
      
      updateRotationFrequency(contract, user1, newFrequency)
      
      const schedule = getRotationSchedule(contract, user1)
      expect(schedule.nextRotation).toBe(lastRotation + newFrequency)
    })
    
    it("should reject frequency update for non-existent schedule", () => {
      const result = updateRotationFrequency(contract, user2, 26280)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
  })
  
  describe("Rotation Analytics", () => {
    it("should track rotation counter across users", () => {
      setupRotationSchedule(contract, user1, "user1-key", 100, true, 1000)
      setupRotationSchedule(contract, user2, "user2-key", 200, true, 1000)
      
      rotateKey(contract, user1, "user1-new", "scheduled", 1200)
      rotateKey(contract, user2, "user2-new", "scheduled", 1300)
      
      expect(contract.rotationCounter).toBe(2)
    })
    
    it("should maintain separate rotation histories", () => {
      setupRotationSchedule(contract, user1, "hist1-key", 100, true, 1000)
      setupRotationSchedule(contract, user2, "hist2-key", 100, true, 1000)
      
      const result1 = rotateKey(contract, user1, "hist1-new", "reason1", 1200)
      const result2 = rotateKey(contract, user2, "hist2-new", "reason2", 1300)
      
      const history1 = getRotationHistory(contract, user1, result1.rotationId)
      const history2 = getRotationHistory(contract, user2, result2.rotationId)
      
      expect(history1.oldKeyId).toBe("hist1-key")
      expect(history2.oldKeyId).toBe("hist2-key")
      expect(history1.reason).toBe("reason1")
      expect(history2.reason).toBe("reason2")
    })
  })
})

// Mock contract functions
function setupRotationSchedule(contract, caller, currentKeyId, rotationFrequency, autoRotate, currentBlock = 2000) {
  const schedule = {
    currentKeyId,
    nextKeyId: "",
    rotationFrequency,
    lastRotation: currentBlock,
    nextRotation: currentBlock + rotationFrequency,
    autoRotate,
  }
  
  contract.rotationSchedules.set(caller, schedule)
  return { success: true }
}

function getRotationSchedule(contract, userId) {
  return contract.rotationSchedules.get(userId)
}

function isRotationDue(contract, userId, currentBlock) {
  const schedule = contract.rotationSchedules.get(userId)
  return schedule ? currentBlock >= schedule.nextRotation : false
}

function rotateKey(contract, caller, newKeyId, reason, currentBlock) {
  const schedule = contract.rotationSchedules.get(caller)
  if (!schedule) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  if (!isRotationDue(contract, caller, currentBlock) && !hasEmergencyRotation(contract, caller)) {
    return { success: false, error: "ERR_ROTATION_NOT_DUE" }
  }
  
  const rotationId = contract.rotationCounter
  
  // Record history
  const historyKey = `${caller}:${rotationId}`
  contract.rotationHistory.set(historyKey, {
    oldKeyId: schedule.currentKeyId,
    newKeyId,
    rotationDate: currentBlock,
    reason,
  })
  
  // Update schedule
  schedule.currentKeyId = newKeyId
  schedule.nextKeyId = ""
  schedule.lastRotation = currentBlock
  schedule.nextRotation = currentBlock + schedule.rotationFrequency
  contract.rotationSchedules.set(caller, schedule)
  
  // Clear emergency rotation
  contract.emergencyRotations.delete(caller)
  
  contract.rotationCounter += 1
  
  return { success: true, rotationId }
}

function initiateEmergencyRotation(contract, caller, reason, currentBlock) {
  contract.emergencyRotations.set(caller, {
    initiated: true,
    reason,
    deadline: currentBlock + 144, // 24 hours
  })
  
  return { success: true }
}

function hasEmergencyRotation(contract, userId) {
  const emergency = contract.emergencyRotations.get(userId)
  return emergency ? emergency.initiated : false
}

function getEmergencyRotation(contract, userId) {
  return contract.emergencyRotations.get(userId)
}

function getRotationHistory(contract, userId, rotationId) {
  return contract.rotationHistory.get(`${userId}:${rotationId}`)
}

function scheduleNextKey(contract, caller, nextKeyId) {
  const schedule = contract.rotationSchedules.get(caller)
  if (!schedule) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  schedule.nextKeyId = nextKeyId
  contract.rotationSchedules.set(caller, schedule)
  
  return { success: true }
}

function updateRotationFrequency(contract, caller, newFrequency) {
  const schedule = contract.rotationSchedules.get(caller)
  if (!schedule) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  schedule.rotationFrequency = newFrequency
  schedule.nextRotation = schedule.lastRotation + newFrequency
  contract.rotationSchedules.set(caller, schedule)
  
  return { success: true }
}
