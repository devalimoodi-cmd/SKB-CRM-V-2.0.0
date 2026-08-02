/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} username
 * @property {string} email
 * @property {string} mobile_number
 * @property {string} role
 * @property {string} status
 * @property {string} profile_image
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Customer
 * @property {number} id
 * @property {string} full_name
 * @property {string} collection_name
 * @property {string} farm_name
 * @property {string} mobile_number
 * @property {string} messaging_number
 * @property {string} email
 * @property {string} province
 * @property {string} county
 * @property {string} farm_address
 * @property {string} postal_code
 * @property {string} education_level
 * @property {string} sales_department
 * @property {string} gender
 * @property {string} experience_years
 * @property {string} skb_how_know
 * @property {string} date_of_birth
 * @property {boolean} active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Period
 * @property {number} id
 * @property {number} customer_id
 * @property {string} period_name
 * @property {number} period_number
 * @property {string} start_date
 * @property {string} end_date
 * @property {string} status
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Hall
 * @property {number} id
 * @property {number} customer_id
 * @property {number} period_id
 * @property {string} hall_name
 * @property {number} hall_number
 * @property {number} nominal_capacity
 * @property {number} altitude_above_sea
 * @property {number} hall_type_id
 * @property {number} construction_year
 * @property {number} service_expert_id
 * @property {string} operator_name
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Flock
 * @property {number} id
 * @property {number} customer_id
 * @property {number} period_id
 * @property {number} hall_id
 * @property {string} placement_date
 * @property {number} flock_number
 * @property {number} chick_source_id
 * @property {number} breed_id
 * @property {number} chick_age_on_arrival
 * @property {number} avg_initial_weight
 * @property {number} total_chicks_count
 * @property {number} placement_density
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} WeeklyRecord
 * @property {number} id
 * @property {number} customer_id
 * @property {number} period_id
 * @property {number} hall_id
 * @property {number} chick_placement_id
 * @property {string} week_start_date
 * @property {string} week_end_date
 * @property {number} week_number
 * @property {number} flock_age_days
 * @property {number} daily_feed_intake
 * @property {number} weekly_feed_intake
 * @property {number} weekly_weight
 * @property {number} weekly_mortality
 * @property {number} blackout_hours
 * @property {string} additional_notes
 * @property {number} service_expert_id
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Bookmark
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {string} type
 * @property {string} priority
 * @property {string} status
 * @property {string} due_date
 * @property {number} customer_id
 * @property {number} period_id
 * @property {number} flock_id
 * @property {number} flock_age_days
 * @property {number} created_by
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} VisitReport
 * @property {number} id
 * @property {number} customer_id
 * @property {number} period_id
 * @property {string} visit_date
 * @property {string} forward_to
 * @property {string} report_text
 * @property {string} status
 * @property {number} created_by
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} message
 * @property {*} data
 * @property {Array<string>} errors
 */

/**
 * @typedef {Object} Pagination
 * @property {number} page
 * @property {number} limit
 * @property {number} total
 * @property {number} totalPages
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {boolean} success
 * @property {string} message
 * @property {Array<*>} data
 * @property {Pagination} pagination
 */
