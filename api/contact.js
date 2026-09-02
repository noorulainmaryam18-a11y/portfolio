const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);


// ===============================
// VALIDATION
// ===============================

const NAME_PATTERN = /^[A-Za-z\s]{2,50}$/;

const GMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

const DIAL_CODE_PATTERN =
  /^\+\d{1,4}$/;

const PK_MOBILE_PATTERN =
  /^3\d{9}$/;

const GENERIC_PHONE_PATTERN =
  /^\d{7,12}$/;


function validateContactPayload(body) {

  const errors = {};

  const {
    name,
    email,
    countryCode,
    phone,
    subject,
    message
  } = body || {};


  // Name
  if (!name || !name.trim()) {

    errors.name = "Name is required";

  } else if (!NAME_PATTERN.test(name.trim())) {

    errors.name =
      "Only alphabets and spaces are allowed";

  }


  // Email
  if (!email || !email.trim()) {

    errors.email = "Email is required";

  } else if (!GMAIL_PATTERN.test(email.trim())) {

    errors.email =
      "Only a valid Gmail address is allowed";

  }


  // Phone
  if (!phone || !phone.trim()) {

    errors.phone = "Phone number is required";

  } else {

    const parts =
      phone.trim().split(/\s+/);

    const code =
      countryCode || parts[0];

    const digits = (
      parts.length > 1
        ? parts.slice(1).join("")
        : phone.replace(code, "")
    ).replace(/\D/g, "");


    if (!DIAL_CODE_PATTERN.test(code)) {

      errors.phone =
        "Invalid country code";

    } else if (!digits) {

      errors.phone =
        "Phone number is required";

    } else if (code === "+92") {

      if (!PK_MOBILE_PATTERN.test(digits)) {

        errors.phone =
          "Enter a valid Pakistani mobile number, e.g. +92 3001234567";

      }

    } else if (!GENERIC_PHONE_PATTERN.test(digits)) {

      errors.phone =
        "Enter a valid phone number (7–12 digits)";

    }

  }


  // Message
  if (!message || !message.trim()) {

    errors.message =
      "Message is required";

  } else if (message.trim().length < 10) {

    errors.message =
      "Message should be at least 10 characters";

  }


  // Subject
  const cleanSubject =
    subject
      ? String(subject).trim().slice(0, 150)
      : "";


  return {

    errors,

    isValid:
      Object.keys(errors).length === 0,

    cleanSubject

  };

}


// ===============================
// PHONE NORMALIZATION
// ===============================

function normalizePhone(
  countryCode,
  phone
) {

  const parts =
    phone.trim().split(/\s+/);

  const code =
    countryCode || parts[0];

  const digits = (
    parts.length > 1
      ? parts.slice(1).join("")
      : phone.replace(code, "")
  ).replace(/\D/g, "");


  return `${code} ${digits}`;

}


// ===============================
// API
// ===============================

module.exports = async (req, res) => {


  // =====================================
  // GET - FETCH MESSAGES
  // =====================================

  if (req.method === "GET") {

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    res.setHeader(
      "Surrogate-Control",
      "no-store"
    );


    try {

      const {
        data,
        error
      } = await supabase

        .from("contact_submissions")

        .select("*")

        .order(
          "received_at",
          {
            ascending: false
          }
        );


      if (error) {

        console.error(
          "Supabase GET error:",
          error
        );

        return res.status(500).json({

          success: false,

          error: error.message

        });

      }


      return res.status(200).json({

        success: true,

        submissions:
          data || []

      });


    } catch (error) {

      console.error(
        "Contact GET error:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          "Could not fetch messages."

      });

    }

  }


  // =====================================
  // ONLY POST AFTER GET
  // =====================================

  if (req.method !== "POST") {

    return res.status(405).json({

      success: false,

      error:
        "Method not allowed"

    });

  }


  // =====================================
  // POST - SAVE MESSAGE
  // =====================================

  try {

    const {
      errors,
      isValid,
      cleanSubject
    } =
      validateContactPayload(
        req.body
      );


    if (!isValid) {

      return res.status(400).json({

        success: false,

        error:
          Object.values(errors)[0],

        fieldErrors:
          errors

      });

    }


    const {

      name,
      email,
      countryCode,
      phone,
      message,
      sent_at

    } = req.body;


    // =====================================
    // SENT TIME
    // =====================================

    /*
      sent_at browser se aayega.

      Agar browser ne sent_at nahi bheja,
      to server ka current time use hoga.
    */

    let sentTime;


    if (sent_at) {

      const parsedSentTime =
        new Date(sent_at);


      if (
        !Number.isNaN(
          parsedSentTime.getTime()
        )
      ) {

        sentTime =
          parsedSentTime.toISOString();

      } else {

        sentTime =
          new Date().toISOString();

      }

    } else {

      sentTime =
        new Date().toISOString();

    }


    // =====================================
    // RECEIVED TIME
    // =====================================

    /*
      Ye exact server/API receiving time hai.
    */

    const receivedTime =
      new Date().toISOString();


    // =====================================
    // DATABASE ENTRY
    // =====================================

    const entry = {

      name:
        name.trim(),

      email:
        email.trim(),

      phone:
        normalizePhone(
          countryCode,
          phone
        ),

      subject:
        cleanSubject,

      message:
        message.trim(),

      // New fields
      sent_at:
        sentTime,

      received_at:
        receivedTime,

      // Keep old field for compatibility
      submitted_at:
        receivedTime

    };


    const {
      error
    } = await supabase

      .from("contact_submissions")

      .insert([entry]);


    if (error) {

      console.error(
        "Supabase INSERT error:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          "Could not save your message."

      });

    }


    // =====================================
    // SUCCESS
    // =====================================

    return res.status(201).json({

      success: true,

      message:
        "Message sent successfully!"

    });


  } catch (error) {

    console.error(
      "Contact API error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        "Something went wrong. Please try again."

    });

  }

};