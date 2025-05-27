;; Quantum-Resistant Cryptography Contract
;; Manages post-quantum security algorithms and keys

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_INVALID_ALGORITHM (err u201))
(define-constant ERR_KEY_NOT_FOUND (err u202))
(define-constant ERR_ALGORITHM_DEPRECATED (err u203))

;; Supported quantum-resistant algorithms
(define-map supported-algorithms
  { algorithm-name: (string-ascii 32) }
  {
    security-level: uint,
    key-size: uint,
    signature-size: uint,
    status: (string-ascii 20),
    nist-approved: bool
  }
)

;; User quantum-safe keys
(define-map user-quantum-keys
  { user-id: principal, key-id: (string-ascii 32) }
  {
    public-key-hash: (buff 32),
    algorithm: (string-ascii 32),
    creation-date: uint,
    expiry-date: uint,
    usage-count: uint
  }
)

;; Algorithm performance metrics
(define-map algorithm-metrics
  { algorithm-name: (string-ascii 32) }
  {
    verification-time: uint,
    key-generation-time: uint,
    signature-time: uint
  }
)

;; Initialize supported algorithms
(map-set supported-algorithms
  { algorithm-name: "CRYSTALS-Dilithium" }
  {
    security-level: u3,
    key-size: u1952,
    signature-size: u3293,
    status: "active",
    nist-approved: true
  }
)

(map-set supported-algorithms
  { algorithm-name: "FALCON" }
  {
    security-level: u5,
    key-size: u1793,
    signature-size: u666,
    status: "active",
    nist-approved: true
  }
)

;; Read-only functions
(define-read-only (get-algorithm-info (algorithm-name (string-ascii 32)))
  (map-get? supported-algorithms { algorithm-name: algorithm-name })
)

(define-read-only (is-algorithm-approved (algorithm-name (string-ascii 32)))
  (match (map-get? supported-algorithms { algorithm-name: algorithm-name })
    algo-data (and
      (get nist-approved algo-data)
      (is-eq (get status algo-data) "active")
    )
    false
  )
)

(define-read-only (get-user-key (user-id principal) (key-id (string-ascii 32)))
  (map-get? user-quantum-keys { user-id: user-id, key-id: key-id })
)

(define-read-only (get-algorithm-metrics (algorithm-name (string-ascii 32)))
  (map-get? algorithm-metrics { algorithm-name: algorithm-name })
)

;; Public functions
(define-public (register-quantum-key
  (key-id (string-ascii 32))
  (public-key-hash (buff 32))
  (algorithm (string-ascii 32))
  (validity-period uint)
)
  (begin
    (asserts! (is-algorithm-approved algorithm) ERR_INVALID_ALGORITHM)
    (asserts! (is-none (map-get? user-quantum-keys { user-id: tx-sender, key-id: key-id })) ERR_UNAUTHORIZED)

    (map-set user-quantum-keys
      { user-id: tx-sender, key-id: key-id }
      {
        public-key-hash: public-key-hash,
        algorithm: algorithm,
        creation-date: block-height,
        expiry-date: (+ block-height validity-period),
        usage-count: u0
      }
    )

    (ok true)
  )
)

(define-public (increment-key-usage (key-id (string-ascii 32)))
  (match (map-get? user-quantum-keys { user-id: tx-sender, key-id: key-id })
    key-data (begin
      (map-set user-quantum-keys
        { user-id: tx-sender, key-id: key-id }
        (merge key-data { usage-count: (+ (get usage-count key-data) u1) })
      )
      (ok true)
    )
    ERR_KEY_NOT_FOUND
  )
)

(define-public (add-algorithm
  (algorithm-name (string-ascii 32))
  (security-level uint)
  (key-size uint)
  (signature-size uint)
  (nist-approved bool)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    (map-set supported-algorithms
      { algorithm-name: algorithm-name }
      {
        security-level: security-level,
        key-size: key-size,
        signature-size: signature-size,
        status: "active",
        nist-approved: nist-approved
      }
    )

    (ok true)
  )
)

(define-public (deprecate-algorithm (algorithm-name (string-ascii 32)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    (match (map-get? supported-algorithms { algorithm-name: algorithm-name })
      algo-data (map-set supported-algorithms
        { algorithm-name: algorithm-name }
        (merge algo-data { status: "deprecated" })
      )
      false
    )

    (ok true)
  )
)
