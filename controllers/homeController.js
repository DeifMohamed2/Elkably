const User = require('../models/User');
const Group = require('../models/Group');
const waziper = require('../utils/waziper');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const qrcode = require('qrcode'); 


const jwtSecret = process.env.JWTSECRET;
// Get instance IDs from environment variables and provide defaults if not found
const instanceID1 = '6855564C3C835';
const instanceID2 = '68555884791C6';
const instanceID3 = '68555697EE266';

console.log('WhatsApp Instance IDs loaded:');
console.log('instanceID1 (GTA):', instanceID1);
console.log('instanceID2 (tagmo3):', instanceID2);
console.log('instanceID3 (Online):', instanceID3);



async function sendQRCode(chatId, message, studentCode, centerName) {
  try {
    console.log('Sending QR code for center:', centerName);

    // Each center has its own dedicated WhatsApp instance for sending messages
    // - tagmo3 center uses instanceID2
    // - GTA center uses instanceID1
    // - All other centers (including Online, etc.) use instanceID3
    const instanceId = centerName === 'tagmo3'
      ? instanceID2
      : centerName === 'GTA'
        ? instanceID1
        : instanceID3;
    
    console.log('Using WhatsApp instance ID:', instanceId);
    
    // Format phone number for Waziper API (remove @c.us suffix)
    const phoneNumber = chatId.replace('@c.us', '');
    console.log('Sending to phone number:', phoneNumber);
    

    // Then create a publicly accessible URL for the QR code
    // For this example, we'll use a placeholder URL that generates QR codes
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(studentCode)}`;
    
    // Send the QR code as a media message
    const mediaResponse = await waziper.sendMediaMessage(
      instanceId,
      phoneNumber,
      message,
      qrCodeUrl,
      'qrcode.png'
    );

    console.log('QR code sent successfully:', mediaResponse.data);
    return { success: true };
  } catch (error) {
    console.error('Error sending QR code:', error);
    return { success: false, error: error.message };
  }
}

// Example usage
// sendQRCode('201156012078@c.us', '313"Dasdadad13',"222","Online");


const home_page = (req, res) => {
  res.render('index', { title: 'Home Page' });
};

const public_login_get = (req, res) => {
  res.render('login', {
    title: 'Login Page',
    Email: '',
    Password: '',
    error: '',
  });
};

const public_login_post = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    const user = await User.findOne({
      $or: [{ phone: emailOrPhone }],
    });

    if (!user) {
      return res
        .status(401)
        .render('login', {
          title: 'Login Page',
          Email: '',
          Password: null,
          error: 'البريد الالكتروني او كلمه المرور خاطئه',
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .render('login', {
          title: 'Login Page',
          Email: '',
          Password: null,
          error: 'البريد الالكتروني او كلمه المرور خاطئه',
        });
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret);
    res.cookie('token', token, { httpOnly: true });

    if (user.isTeacher) {
      return res.redirect('/teacher/dash');
    } else {
      if (user.subscribe) {
        return res.redirect('/student/dash');
      } else {
        return res.redirect('/login');
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).redirect('/login');
  }
};

const public_Register_get = (req, res) => {
  const StudentCode = req.query.StudentCode;

  res.render('Register', {
    title: 'Login Page',
    formData: req.body,
    firebaseError: '',
    StudentCode,
  });
};

// const public_Register_post = async (req, res) => {
//   const {
//     phoneCloumnName,
//     studentPhoneCloumnName,
//     nameCloumnName,
//     centerName,
//     Grade,
//     gradeType,
//     groupTime,
//     emailCloumn,
//     schoolCloumn,
//     gradeInNumberCloumn,
//     CodeCloumn,
//     dataToSend,
//     // verificationCode,
//   } = req.body;

//   let n = 0;
//   req.io.emit('sendingMessages', {
//     nMessages: n,
//   });

//       dataToSend.forEach(async (student) => {
//         console.log(
//           'student',
//           student[phoneCloumnName],
//           student[studentPhoneCloumnName],
//           student[nameCloumnName],
//           student[emailCloumn],
//           student[schoolCloumn],
//           student[gradeInNumberCloumn],
//           student[CodeCloumn],
//           centerName,
//           Grade,
//           gradeType,
//           groupTime
//         );

//   const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

//     const user = new User({
//       Username: student[nameCloumnName],
//       Password: hashedPassword,
//       passwordWithoutHash: '1qaz2wsx',
//       Code: student[CodeCloumn],
//       phone: student[studentPhoneCloumnName],
//       parentPhone: student[phoneCloumnName],
//       gradeInNumber : student[gradeInNumberCloumn],
//       school : student[schoolCloumn],
//       email : student[emailCloumn],
//       centerName: centerName,
//       Grade: Grade,
//       gradeType: gradeType,
//       groupTime: groupTime,
//       subscribe: false,
//       balance: '100',

//       isTeacher: false,
//     });
//     console.log('done1');
//     user
//       .save()
//       .then(async (result) => {
//         await Group.findOneAndUpdate(
//           {
//             CenterName: centerName,
//             Grade: Grade,
//             gradeType: gradeType,
//             GroupTime: groupTime,
//           },
//           { $push: { students: result._id } },
//           { new: true, upsert: true }
//         )
//           .then(() => {
//             console.log('done2');
//           })
//       })


        
// })

// };
const public_Register_post = async (req, res) => {
  const {
    Username,
    Grade,
    phone,
    parentPhone,
    phoneCountryCode,
    parentPhoneCountryCode,
    centerName,
    gradeType,
    groupTime,
    balance,
    Code,
    GradeLevel,
    attendingType,
    bookTaken,
    schoolName,
  } = req.body;

  // Create an object to store validation errors
  const errors = {};

  // Phone validation is now more flexible due to different country codes
  if (!phone || phone.length < 8) {
    req.body.phone = '';
    errors.phone = '- رقم الهاتف غير صحيح';
  }

  // Parent phone validation
  if (!parentPhone || parentPhone.length < 8) {
    req.body.parentPhone = '';
    errors.parentPhone = '- رقم هاتف ولي الامر غير صحيح';
  }

  // Check if phone is equal to parentPhone
  if (phone === parentPhone) {
    // Clear the phone and parentPhone fields in the form data
    req.body.phone = '';
    req.body.parentPhone = '';

    // Set an error message for this condition
    errors.phone = '- رقم هاتف الطالب لا يجب ان يساوي رقم هاتف ولي الامر';
  }

  if (!Grade) {
    errors.Grade = '- يجب اختيار الصف الدراسي';
  }

  if (!centerName) {
    errors.centerName = '- يجب اختيار اسم center';
  }

  if (!gradeType) {
    errors.gradeType = '- يجب اختيار نوع الصف';
  }

  if (!groupTime) {
    errors.groupTime = '- يجب اختيار وقت المجموعه';
  }

  if (!balance) {
    errors.balance = '- يجب ادخال الرصيد';
  }

  if (!Code) {
    errors.Code = '- يجب ادخال كود الطالب';
  }

  if (!GradeLevel) {
    errors.GradeLevel = '- يجب ادخال المرحله الدراسيه';
  }

  if (!attendingType) {
    errors.attendingType = '- يجب ادخال نوع الحضور';
  }

  if (!schoolName) {
    errors.schoolName = '- يجب ادخال اسم المدرسه';
  }

  // If there are any errors, render the form again with the errors object

  if (Object.keys(errors).length > 0) {
    return res.render('Register', {
      title: 'Register Page',
      errors: errors,
      firebaseError: '',
      formData: req.body, // Pass the form data back to pre-fill the form
    });
  }

  

  const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

  try {
    // Format phone numbers with country codes
 
    const user = new User({
      Username: Username,
      Password: hashedPassword,
      Code: Code,
      phone: phone,
      parentPhone: parentPhone,
      phoneCountryCode: phoneCountryCode || '20',
      parentPhoneCountryCode: parentPhoneCountryCode || '20',
      centerName: centerName,
      Grade: Grade,
      gradeType: gradeType,
      groupTime: groupTime,
      GradeLevel: GradeLevel,
      attendingType: attendingType,
      bookTaken: bookTaken,
      schoolName: schoolName,
      balance: balance,
    });
    user
      .save()
      .then(async (result) => {
        await Group.findOneAndUpdate(
          {
            CenterName: centerName,
            Grade: Grade,
            gradeType: gradeType,
            GroupTime: groupTime,
          },
          { $push: { students: result._id } },
          { new: true, upsert: true }
        )
          .then(async () => {
            try {
              console.log("Attempting to send QR code to student...");
              
              // Use the formatted phone with country code
              const qrResult = await sendQRCode(
                `2${phone}@c.us`,
                `This is your QR Code \n\n Student Name: ${Username} \n\n Student Code: ${Code} \n\n Grade: ${Grade} \n\n Grade Level: ${GradeLevel} \n\n Attendance Type: ${attendingType} \n\n Book Taken: ${
                  bookTaken ? 'Yes' : 'No'
                } \n\n School: ${schoolName} \n\n Balance: ${balance} \n\n Center Name: ${centerName} \n\n Grade Type: ${gradeType} \n\n Group Time: ${groupTime} `,
                Code,
                centerName
              );
              
              console.log("QR code sending result:", qrResult);
              
              res
                .status(201)
                .redirect('Register');
            } catch (qrError) {
              console.error("Failed to send QR code:", qrError);
              // Still redirect to Register even if QR code sending fails
              res
                .status(201)
                .redirect('Register');
            }
          })
          .catch((err) => {
            console.log(err);
          });
      })

      .catch((error) => {
        console.log('Error caught:', error);
        if (error.name === 'MongoServerError' && error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0]; // Log the field causing the duplicate
          console.log('Duplicate field:', field); // Log the duplicate field for clarity
          if (field === 'phone') {
            errors.phone = 'هذا الرقم مستخدم من قبل';
          } else {
            errors[field] = `The ${field} is already in use.`;
          }
          res.render('Register', {
            title: 'Register Page',
            errors: errors,
            firebaseError: '',
            formData: req.body,
          });
        } else {
          console.error(error);
          res.status(500).json({ message: 'Internal Server Error' });
        }
      });

  } catch (error) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
      // Duplicate key error
      errors.emailDub = 'This email is already in use.';
      // Handle the error as needed
      res.status(409).json({ message: 'User already in use' });
    } else {
      // Handle other errors
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

const send_verification_code = async (req, res) => {
  try {
    const { phone } = req.body;
    const code = Math.floor(Math.random() * 400000 + 600000);
    const message = `كود التحقق الخاص بك هو ${code}`;

    console.log(`Sending verification code ${code} to phone number: ${phone}`);
    
    // Get country code from request or use default (20 for Egypt)
    const countryCode = req.body.phoneCountryCode || '20';
    
    // Format phone number for Waziper API
    const phoneNumber = `${countryCode}${phone}`;

    try {
      console.log(`Using Waziper API to send message to ${phoneNumber} with country code ${countryCode}`);
      
      // Use instanceID1 instead of hardcoded ID
      const instanceId = instanceID1;
      console.log(`Using WhatsApp instance ID: ${instanceId}`);
      
      // Send the message via the Waziper API
      const response = await waziper.sendTextMessage(
        instanceId,
        phoneNumber,
        message
      );

      console.log('Verification code sent successfully:', response.data);
      
      // Store the verification code and phone in the session or database
      req.session.verificationCode = code; // Assuming session middleware is used
      req.session.phone = phone;

      // Send a successful response
      res.status(201).json({ success: true, data: response.data });
    } catch (err) {
      // Handle any error that occurs during the Waziper API call
      console.error('Error sending verification code:', err);
      console.error('Error details:', err.response?.data || err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};

const forgetPassword_get = (req, res) => {
  res.render('forgetPassword', {
    title: 'Forget Password',
    error: null,
    success: null,
  });
};

const forgetPassword_post = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({
      $or: [{ phone: phone }],
    });

    if (!user && phone) {
      res.render('forgetPassword', {
        title: 'Forget Password',
        error: 'لا يوجد حساب لهذا الايميل او رقم الهاتف',
        success: null,
      });
      return '';
    } else if (user && phone) {
      const secret = jwtSecret + user.Password;
      const token = jwt.sign({ phone: phone, _id: user._id }, secret, {
        expiresIn: '15m',
      });
      const link = `http://localhost:3000/reset-password/${user._id}/${token}`;

      // Send reset password link via WhatsApp using Waziper API
      try {
        // Format phone number for Waziper API
        const phoneNumber = `2${phone}`;
        const message = `رابط إعادة تعيين كلمة المرور الخاص بك: ${link}`;
        
        // Determine which instance to use (using default instance for this example)
        const instanceId = instanceID1;
        
        await waziper.sendTextMessage(instanceId, phoneNumber, message);
        
        res.render('forgetPassword', {
          title: 'Forget Password',
          error: null,
          success: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى رقم الهاتف الخاص بك',
        });
      } catch (err) {
        console.error('Error sending reset password link:', err);
        res.render('forgetPassword', {
          title: 'Forget Password',
          error: 'حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور',
          success: null,
        });
      }
      
      return '';
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error'); // Handle other errors
  }

  res.render('forgetPassword', {
    title: 'Forget Password',
    error: null,
    success: null,
  });
};

const reset_password_get = async (req, res) => {
  try {
    const { id, token } = req.params;

    const user = await User.findOne({ _id: id });
    if (!user) {
      res.send('invalid Id....');
      return;
    }
    const secret = jwtSecret + user.Password;
    const payload = jwt.verify(token, secret);
    res.render('reset-password', { phone: user.phone, error: null });
  } catch (error) {
    res.send(error.message);
  }
};

const reset_password_post = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { password1, password2 } = req.body;
    const user = await User.findOne({ _id: id });
    if (!user) {
      res.send('invalid Id....');
      return;
    }
    if (password1 === password2) {
      const secret = jwtSecret + user.Password;
      const payload = jwt.verify(token, secret);
      const hashedPassword = await bcrypt.hash(password1, 10);
      await User.findByIdAndUpdate({ _id: id }, { Password: hashedPassword })
        .then(() => {
          res.redirect('/login');
        })
        .catch((error) => {
          res.send(error.message);
        });
    } else {
      res.render('reset-password', {
        phone: user.phone,
        error: 'لازم يكونو شبه بعض',
      });
    }
  } catch (error) {
    res.send(error.message);
  }
};

module.exports = {
  home_page,
  public_login_get,
  public_Register_get,
  public_Register_post,
  send_verification_code,
  public_login_post,
  forgetPassword_get,
  forgetPassword_post,
  reset_password_get,
  reset_password_post,
};
