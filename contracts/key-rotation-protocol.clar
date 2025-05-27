;; Key Rotation Protocol Contract
;; Handles quantum-safe key updates and rotation schedules

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_ROTATION_NOT_DUE (err u301))
(define-constant ERR_INVALID_KEY (err u302))
(define-constant ERR_ROTATION_IN_PROGRESS (err u303))

;; Key rotation schedules
(define-map rotation-schedules
  { user-id: principal }
  {
    current-key-id: (string-ascii 32),
    next-key-id: (string-ascii 32),
    rotation-frequency: uint,
    last-rotation: uint,
    next-rotation: uint,
    auto-rotate: bool
  }
)

;; Rotation history
(define-map rotation-history
  { user-id: principal, rotation-id: uint }
  {
    old-key-id: (string-ascii 32),
    new-key-id: (string-ascii 32),
    rotation-date: uint,
    reason: (string-ascii 50)
  }
)

;; Global rotation counter
(define-data-var rotation-counter uint u0)

;; Emergency rotation flags
(define-map emergency-rotations
  { user-id: principal }
  {
    initiated: bool,
    reason: (string-ascii 100),
    deadline: uint
  }
)

;; Read-only functions
(define-read-only (get-rotation-schedule (user-id principal))
  (map-get? rotation-schedules { user-id: user-id })
)

(define-read-only (is-rotation-due (user-id principal))
  (match (map-get? rotation-schedules { user-id: user-id })
    schedule (>= block-height (get next-rotation schedule))
    false
  )
)

(define-read-only (get-rotation-history (user-id principal) (rotation-id uint))
  (map-get? rotation-history { user-id: user-id, rotation-id: rotation-id })
)

(define-read-only (has-emergency-rotation (user-id principal))
  (match (map-get? emergency-rotations { user-id: user-id })
    emergency (get initiated emergency)
    false
  )
)

;; Public functions
(define-public (setup-rotation-schedule
  (current-key-id (string-ascii 32))
  (rotation-frequency uint)
  (auto-rotate bool)
)
  (begin
    (map-set rotation-schedules
      { user-id: tx-sender }
      {
        current-key-id: current-key-id,
        next-key-id: "",
        rotation-frequency: rotation-frequency,
        last-rotation: block-height,
        next-rotation: (+ block-height rotation-frequency),
        auto-rotate: auto-rotate
      }
    )

    (ok true)
  )
)

(define-public (rotate-key
  (new-key-id (string-ascii 32))
  (reason (string-ascii 50))
)
  (let ((rotation-id (var-get rotation-counter)))
    (match (map-get? rotation-schedules { user-id: tx-sender })
      schedule (begin
        (asserts! (or
          (is-rotation-due tx-sender)
          (has-emergency-rotation tx-sender)
        ) ERR_ROTATION_NOT_DUE)

        ;; Record rotation history
        (map-set rotation-history
          { user-id: tx-sender, rotation-id: rotation-id }
          {
            old-key-id: (get current-key-id schedule),
            new-key-id: new-key-id,
            rotation-date: block-height,
            reason: reason
          }
        )

        ;; Update rotation schedule
        (map-set rotation-schedules
          { user-id: tx-sender }
          {
            current-key-id: new-key-id,
            next-key-id: "",
            rotation-frequency: (get rotation-frequency schedule),
            last-rotation: block-height,
            next-rotation: (+ block-height (get rotation-frequency schedule)),
            auto-rotate: (get auto-rotate schedule)
          }
        )

        ;; Clear emergency rotation if it exists
        (map-delete emergency-rotations { user-id: tx-sender })

        ;; Increment counter
        (var-set rotation-counter (+ rotation-id u1))

        (ok rotation-id)
      )
      ERR_UNAUTHORIZED
    )
  )
)

(define-public (initiate-emergency-rotation (reason (string-ascii 100)))
  (begin
    (map-set emergency-rotations
      { user-id: tx-sender }
      {
        initiated: true,
        reason: reason,
        deadline: (+ block-height u144) ;; 24 hours in blocks
      }
    )

    (ok true)
  )
)

(define-public (schedule-next-key (next-key-id (string-ascii 32)))
  (match (map-get? rotation-schedules { user-id: tx-sender })
    schedule (begin
      (map-set rotation-schedules
        { user-id: tx-sender }
        (merge schedule { next-key-id: next-key-id })
      )
      (ok true)
    )
    ERR_UNAUTHORIZED
  )
)

(define-public (update-rotation-frequency (new-frequency uint))
  (match (map-get? rotation-schedules { user-id: tx-sender })
    schedule (begin
      (map-set rotation-schedules
        { user-id: tx-sender }
        (merge schedule {
          rotation-frequency: new-frequency,
          next-rotation: (+ (get last-rotation schedule) new-frequency)
        })
      )
      (ok true)
    )
    ERR_UNAUTHORIZED
  )
)
