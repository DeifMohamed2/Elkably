const User = require('../models/User');
const Group  = require('../models/Group');
// Removed WhatsAppInstance model – fully API-driven via Wasender
const Card = require('../models/Card');
const Attendance = require('../models/Attendance'); 

const wasender = require('../utils/wasender');
const Excel = require('exceljs');
const QRCode = require('qrcode');

const dash_get = async(req, res) => {
  //   const idsToKeep = [
  //     "65e4cfe6022bba8f9ed4a80f",
  //     "65e4d024022bba8f9ed4a811",
  //     "65e4d045022bba8f9ed4a813",
  //     "65eb2856a76c472e4fa64fd3",
  //     "65e8fd8449a3eecaa4593bd3"
  // ];
  //   User.deleteMany({ _id: { $nin: idsToKeep } })
  //   .then(result => {
  //       console.log(`${result.deletedCount} users deleted.`);
  //   })
  //   .catch(error => {
  //       console.error("Error deleting users:", error);
  //   });


  
 

  res.render('teacher/dash', { title: 'DashBoard', path: req.path });
};

const myStudent_get = (req, res) => {
  res.render('teacher/myStudent', {
    title: 'Mystudent',
    path: req.path,
    userData: null,
    attendance: null,
  });
};

// =================================================== Student Requests ================================================ //

let query;
const studentsRequests_get = async (req, res) => {
  try {
    const {
      centerName,
      Grade,
      gradeType,
      groupTime,
      attendingType,
      GradeLevel,
      page = 1,
    } = req.query;

    // Build the query dynamically
    query = { centerName, Grade, gradeType, groupTime };
    if (attendingType) query.attendingType = attendingType;
    if (GradeLevel) query.GradeLevel = GradeLevel;

    // Pagination variables
    const perPage = 500;

    // Execute the query with pagination
    const [result, count] = await Promise.all([
      User.find(query, {
        Username: 1,
        Code: 1,
        balance: 1,
        amountRemaining: 1,
        createdAt: 1,
        updatedAt: 1,
        blocked: 1,
        blockReason: 1,
        blockedAt: 1,
        blockedBy: 1,
        bookTaken: 1,
      })
        .sort({ subscribe: 1, createdAt: 1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .exec(),
      User.countDocuments(query),
    ]);

    // Calculate pagination details
    const nextPage = parseInt(page) + 1;
    const hasNextPage = nextPage <= Math.ceil(count / perPage);
    const hasPreviousPage = page > 1;

    // Render the response
    res.render('teacher/studentsRequests', {
      title: 'StudentsRequests',
      path: req.path,
      modalData: null,
      modalDelete: null,
      studentsRequests: result,
      Grade,
      isSearching: false,
      nextPage: hasNextPage ? nextPage : null,
      previousPage: hasPreviousPage ? page - 1 : null,
    });
  } catch (error) {
    console.error('Error in studentsRequests_get:', error);
    res.status(500).send('Internal Server Error');
  }
};


const searchForUser = async (req, res) => {
  const { searchBy, searchInput } = req.body;
  try {
    // Build the search query with exact matching
    let searchQuery = {};
    
    if (searchBy === 'Code') {
      // For Code searches, use exact matching - no regex, no prefix variations
      searchQuery[searchBy] = searchInput.trim();
    } else {
      // For other fields, use exact matching as well
      searchQuery[searchBy] = searchInput.trim();
    }

    const result = await User.find(searchQuery, {
      Username: 1,
      Code: 1,
      createdAt: 1,
      updatedAt: 1,
      subscribe: 1,
      balance: 1,
      amountRemaining: 1,
      blocked: 1,
      blockReason: 1,
      blockedAt: 1,
      blockedBy: 1,
      bookTaken: 1,
    });

    res.render('teacher/studentsRequests', {
      title: 'StudentsRequests',
      path: req.path,
      modalData: null,
      modalDelete: null,
      studentsRequests: result,
      studentPlace: query?.place || 'All',
      Grade: query?.Grade,
      isSearching: true,
      nextPage: null,
      previousPage: null,
    });
  } catch (error) {
    console.error('Error in searchForUser:', error);
    res.status(500).send('Internal Server Error');
  }
};

const converStudentRequestsToExcel = async (req, res) => {
  try {
    // Fetch user data
    const users = await User.find(query, {
      Username: 1,
      Email: 1,
      gov: 1,
      Markez: 1,
      gender: 1,
      phone: 1,
      WhatsApp: 1,
      parentPhone: 1,
      place: 1,
      Code: 1,
      createdAt: 1,
      updatedAt: 1,
      subscribe: 1,
      bookTaken: 1,
    });

    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Users Data');

    const headerRow = worksheet.addRow([
      '#',
      'User Name',
      'Student Code',
      'Student Phone',
      'Parent Phone',
      'Government',
      'Markez',
      'createdAt',
      'subscribe',
      'Book Taken',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add user data to the worksheet with alternating row colors
    let c = 0;
    users.forEach((user) => {
      c++;
      const row = worksheet.addRow([
        c,
        user.Username,
        user.Code,
        user.phone,
        user.WhatsApp,
        user.parentPhone,
        user.gov,
        user.Markez,
        user.createdAt.toLocaleDateString(),
        user.subscribe,
        user.bookTaken ? 'Yes' : 'No',
      ]);

      // Apply different fill color based on subscription status
      if (!user.subscribe) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0000' },
        }; // Red fill for non-subscribed users
      } else if (c % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        }; // Alternate fill color for subscribed users
      }
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="UsersData.xlsx"`
    );

    // Send Excel file as response
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('An error occurred while generating Excel file.');
  }
};

const getSingleUserAllData = async (req, res) => {
  try {
    const studentID = req.params.studentID;
    console.log(studentID);
    
    // Check if studentID is a MongoDB ObjectId or a student code
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentID);
    
    let query;
    if (isObjectId) {
      query = { _id: studentID };
    } else {
      // Handle as a code with exact matching - no flexible matching
      const codeParam = String(studentID).trim();
      
      // Build query conditions for exact matching only
      const orConditions = [
        { cardId: codeParam },  // Search by card ID
        { Code: codeParam }     // Search by exact code match
      ];
      
      query = { $or: orConditions };
    }
    
    const result = await User.findOne(query);
    
    if (!result) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Include blocking information in the response
    const studentData = {
      ...result.toObject(),
      blocked: result.blocked || false,
      blockReason: result.blockReason,
      blockedAt: result.blockedAt,
      blockedBy: result.blockedBy
    };
    
    res.status(200).send(studentData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserData = async (req, res) => {
  try {
    const {
      Username,
      phone,
      parentPhone,
      balance,
 
      absences,
      amountRemaining,
      GradeLevel,
      attendingType,
      bookTaken,
      schoolName,
    } = req.body;
    const { studentID } = req.params;

    // Validate required fields
    if (!studentID) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    // Get the current student data to compare changes
    const currentStudent = await User.findById(studentID);
    if (!currentStudent) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Build the update object dynamically
    const updateFields = {};
    if (Username) updateFields.Username = Username;
    if (phone) updateFields.phone = phone;
    if (parentPhone) updateFields.parentPhone = parentPhone;
    if (balance !== undefined) updateFields.balance = balance;
    if (amountRemaining !== undefined)
      updateFields.amountRemaining = amountRemaining;
    if (GradeLevel) updateFields.GradeLevel = GradeLevel;
    if (attendingType) updateFields.attendingType = attendingType;
    if (bookTaken !== undefined) updateFields.bookTaken = bookTaken === 'true';
    if (schoolName) updateFields.schoolName = schoolName;
    if (absences) updateFields.absences = absences

    // Update the student document
    const updatedUser = await User.findByIdAndUpdate(studentID, updateFields, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Send WhatsApp notification if book status changed to taken
    if (bookTaken !== undefined && currentStudent.bookTaken !== updatedUser.bookTaken && updatedUser.bookTaken === true) {
      try {
        const bookStatusMessage = `✅ *عزيزي ولي أمر الطالب ${updatedUser.Username}*،\n
نود إعلامكم بأنه تم *تحديث حالة الكتاب* للطالب.\n
*الكتاب: تم استلامه* ✅\n
تاريخ التحديث: ${new Date().toLocaleDateString('ar-EG', {timeZone: 'Africa/Cairo'})}\n
الوقت: ${new Date().toLocaleTimeString('ar-EG', {timeZone: 'Africa/Cairo'})}\n\n
شكراً لتعاونكم.
Elkably Team`;

        const sendResult = await sendWappiMessage(
          bookStatusMessage, 
          updatedUser.parentPhone, 
          req.userData.phone, 
          false, 
          updatedUser.parentPhoneCountryCode
        );
        
        if (!sendResult.success) {
          console.warn(`Warning: Failed to send book status notification to ${updatedUser.Username}'s parent: ${sendResult.message}`);
        } else {
          console.log(`Book status notification sent successfully to ${updatedUser.Username}'s parent`);
        }
      } catch (msgErr) {
        console.warn(`Warning: Error sending book status notification to ${updatedUser.Username}'s parent: ${msgErr.message}`);
      }
    }

    // Redirect or send a success response
    res
      .status(200)
      .json({ message: 'User data updated successfully.', updatedUser });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Block student function
const blockStudent = async (req, res) => {
  try {
    const { studentID } = req.params;
    const { reason } = req.body;

    if (!studentID) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Block reason is required.' });
    }

    const student = await User.findById(studentID);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (student.blocked) {
      return res.status(400).json({ error: 'Student is already blocked.' });
    }

    // Update student with blocking information
    const blockRecord = {
      action: 'blocked',
      reason: reason.trim(),
      blockedAt: new Date(),
      blockedBy: req.userData?.Username || 'Admin',
      timestamp: new Date()
    };

    const updatedStudent = await User.findByIdAndUpdate(
      studentID,
      {
        blocked: true,
        blockReason: reason.trim(),
        blockedAt: new Date(),
        blockedBy: req.userData?.Username || 'Admin',
        $push: { blockHistory: blockRecord }
      },
      { new: true }
    );

    // Send WhatsApp message to parent about the blocking
    if (student.parentPhone) {
      const blockMessage = `⚠️ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأنه تم *إيقاف الطالب مؤقتاً* عن الحضور.\n
السبب: *${reason.trim()}*\n

Elkably Team`;

      try {
        const sendResult = await sendWappiMessage(
          blockMessage, 
          student.parentPhone, 
          req.userData.phone, 
          false, 
          student.parentPhoneCountryCode
        );
        if (!sendResult.success) {
          console.warn(`Warning: Failed to send blocking notification to ${student.Username}'s parent: ${sendResult.message}`);
        }
      } catch (msgErr) {
        console.warn(`Warning: Error sending blocking notification to ${student.Username}'s parent: ${msgErr.message}`);
      }
    }

    res.status(200).json({ 
      message: 'Student blocked successfully.', 
      student: updatedStudent 
    });
  } catch (error) {
    console.error('Error blocking student:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Unblock student function
const unblockStudent = async (req, res) => {
  try {
    const { studentID } = req.params;
    const { reason } = req.body;

    if (!studentID) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    const student = await User.findById(studentID);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (!student.blocked) {
      return res.status(400).json({ error: 'Student is not blocked.' });
    }

    // Update student with unblocking information
    const unblockRecord = {
      action: 'unblocked',
      reason: reason ? reason.trim() : 'No reason provided',
      unblockedAt: new Date(),
      unblockedBy: req.userData?.Username || 'Admin',
      timestamp: new Date()
    };

    const updatedStudent = await User.findByIdAndUpdate(
      studentID,
      {
        blocked: false,
        blockReason: null,
        blockedAt: null,
        blockedBy: null,
        $push: { blockHistory: unblockRecord }
      },
      { new: true }
    );

    // Send WhatsApp message to parent about the unblocking
    if (student.parentPhone) {
      const unblockMessage = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأنه تم *إعادة تفعيل الطالب* ويمكنه الحضور مرة أخرى.\n
${reason ? `السبب: *${reason.trim()}*` : ''}\n
تاريخ إعادة التفعيل: ${new Date().toLocaleDateString('ar-EG', {timeZone: 'Africa/Cairo'})}\n
الوقت: ${new Date().toLocaleTimeString('ar-EG', {timeZone: 'Africa/Cairo'})}\n\n
*يمكن للطالب الآن الحضور بشكل طبيعي.*\n\n
شكراً لتعاونكم.
Elkably Team`;

      try {
        const sendResult = await sendWappiMessage(
          unblockMessage, 
          student.parentPhone, 
          req.userData.phone, 
          false, 
          student.parentPhoneCountryCode
        );
        if (!sendResult.success) {
          console.warn(`Warning: Failed to send unblocking notification to ${student.Username}'s parent: ${sendResult.message}`);
        }
      } catch (msgErr) {
        console.warn(`Warning: Error sending unblocking notification to ${student.Username}'s parent: ${msgErr.message}`);
      }
    }

    res.status(200).json({ 
      message: 'Student unblocked successfully.', 
      student: updatedStudent 
    });
  } catch (error) {
    console.error('Error unblocking student:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// Get student blocking history
const getStudentBlockHistory = async (req, res) => {
  try {
    const { studentID } = req.params;

    if (!studentID) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    const student = await User.findById(studentID).select('Username blockHistory');
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    res.status(200).json({ 
      studentName: student.Username,
      blockHistory: student.blockHistory || [] 
    });
  } catch (error) {
    console.error('Error getting block history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const DeleteStudent = async (req, res) => {
  try {
    const studentID = req.params.studentID;
    if (!studentID) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (
      studentID == '668138aeebc1138a4277c47a' ||
      studentID == '668138edebc1138a4277c47c' ||
      studentID == '66813909ebc1138a4277c47e'
    ) {
      return res.status(400).json({ error: 'You can not delete this user' });
    }

    await Group.updateMany(
      { students: studentID },
      { $pull: { students: studentID } }
    ).then(async(result) => {
      await User.findByIdAndDelete(studentID).then((result) => {
        res
          .status(200)
          .json({ message: 'User deleted successfully.', result });
      });
  });
  } catch (error) {
    console.log(error);
  }
};
// =================================================== END Student Requests ================================================ //

// ===================================================  MyStudent ================================================ //

const searchToGetOneUserAllData = async (req, res) => {
  const { searchBy, searchInput } = req.query;

  try {
     const result = await User.findOne({ [`${searchBy}`]: searchInput })

     const attendance = await Card.findOne({ userId : result._id })


      res.render('teacher/myStudent', {
        title: 'Mystudent',
        path: req.path,
        userData: result,
        attendance: attendance.cardHistory,
      });
   
  } catch (error) {}
};

const convertToExcelAllUserData = async (req, res) => {
  const { studetCode } = req.params;
  console.log(studetCode);
  try {
    // Use exact matching for student code
    const codeParam = String(studetCode).trim();
    const orConditions = [
      { cardId: codeParam },  // Search by card ID
      { Code: codeParam }     // Search by exact code match
    ];
    
    const user = await User.findOne({ $or: orConditions });
    
    if (!user) {
      return res.status(404).json({ message: 'Student not found' });
    }
        // Create a new Excel workbook
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');
        const Header = worksheet.addRow([`بيانات الطالب ${user.Username} `]);
        Header.getCell(1).alignment = { horizontal: 'center' }; // Center align the text
        Header.font = { bold: true, size: 16 };
        Header.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
        worksheet.mergeCells('A1:H1');
        worksheet.addRow();
        const headerRowUserBasicInfo = worksheet.addRow([
          'اسم الطالب',
          'كود الطالب ',
          'رقم هاتف الطالب',
          'رقم هاتف ولي الامر',
        ]);
        headerRowUserBasicInfo.font = { bold: true };
        headerRowUserBasicInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF00' },
        };

        // Add user data to the worksheet with alternating row colors

        const rowUserBasicInfo = worksheet.addRow([
          user.Username,
          user.Code,
          user.phone,
          user.parentPhone,
        ]);
        rowUserBasicInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };

        const headerRowUserVideoInfo = worksheet.addRow([
          '#',
          'اسم الفيديو',
          'عدد مرات المشاهده',
          'عدد المشاهدات المتبقيه ',
          'تاريخ اول مشاهده ',
          'تاريخ اخر مشاهده ',
          'رفع الواجب ',
          'حل الامتحان ',
          'حاله الشراء ',
        ]);
        headerRowUserVideoInfo.font = { bold: true };
        headerRowUserVideoInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '9fea0c' },
        };
        let c = 0;

        user['videosInfo'].forEach((data) => {
          c++;
          let homeWork, Exam;
          if (data.prerequisites == 'WithOutExamAndHW') {
            homeWork = 'لا يوجد';
            Exam = 'لا يوجد';
          } else if (data.prerequisites == 'WithExamaAndHw') {
            homeWork = data.isHWIsUploaded ? 'تم الرفع' : 'لم يُرفع';
            Exam = data.isUserEnterQuiz ? 'تم الدخول' : 'لم يدخل';
          } else if (data.prerequisites == 'WithHw') {
            homeWork = data.isHWIsUploaded ? 'تم الرفع' : 'لم يُرفع';
          } else {
            Exam = data.isUserEnterQuiz ? 'تم الدخول' : 'لم يدخل';
          }

          const headerRowUserVideoInfo = worksheet.addRow([
            c,
            data.videoName,
            data.numberOfWatches,
            data.videoAllowedAttemps,
            new Date(data.fristWatch).toLocaleDateString() || 'لم يشاهد بعد',
            new Date(data.lastWatch).toLocaleDateString() || 'لم يشاهد بعد',
            homeWork,
            Exam,
            data.isVideoPrepaid
              ? data.videoPurchaseStatus
                ? 'تم الشراء'
                : 'لم يتم الشراء'
              : 'الفيديو مجاني',
          ]);

          if (c % 2 === 0) {
            headerRowUserVideoInfo.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'DDDDDD' },
            };
          }
        });
        const headerRowUserQuizInfo = worksheet.addRow([
          '#',
          'اسم الامتحان',
          'تاريخ الحل ',
          'مده الحل ',
          ' درجه الامتحان ',
          'حاله الشراء ',
        ]);
        headerRowUserQuizInfo.font = { bold: true };
        headerRowUserQuizInfo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '10a1c2' },
        };

        let cq = 0;
        user['quizesInfo'].forEach((data) => {
          cq++;
          const headerRowUserQuizInfo = worksheet.addRow([
            cq,
            data.quizName,
            new Date(data.solvedAt).toLocaleDateString() || 'لم يحل',
            data.solveTime || 'لم يحل',
            data.questionsCount + '/' + data.Score,
            data.isQuizPrepaid
              ? data.quizPurchaseStatus
                ? 'تم الشراء'
                : 'لم يتم الشراء'
              : 'الامتحان مجاني',
          ]);
          if (cq % 2 === 0) {
            headerRowUserQuizInfo.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'DDDDDD' },
            };
          }
        });

        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Set response headers for file download
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=users_data.xlsx'
        );

        // Send Excel file as response
        res.send(excelBuffer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error generating Excel file' });
  }
};

// =================================================== END MyStudent ================================================ //

async function sendWasenderMessage(message, phone, adminPhone, isExcel = false, countryCode = '20') {
  try {
    // Skip if phone number is missing or invalid
    const phoneAsString = (typeof phone === 'string' ? phone : String(phone || '')).trim();
    if (!phoneAsString) {
      console.warn('Skipping message - No phone number provided');
      return { success: false, message: 'No phone number provided' };
    }
    
    // Get all sessions to find the one with matching phone number
    const sessionsResponse = await wasender.getAllSessions();
    if (!sessionsResponse.success) {
      console.error(`Failed to get sessions: ${sessionsResponse.message}`);
      return { success: false, message: `Failed to get sessions: ${sessionsResponse.message}` };
    }
    
    const sessions = sessionsResponse.data;
    let targetSession = null;
    
    // Find session by admin phone number
    if (adminPhone == '01065057897') {
      targetSession = sessions.find(s => s.phone_number === '+201065057897' || s.phone_number === '01065057897');
    } else if (adminPhone == '01055640148') {
      targetSession = sessions.find(s => s.phone_number === '+201055640148' || s.phone_number === '01055640148');
    } else if (adminPhone == '01147929010') {
      targetSession = sessions.find(s => s.phone_number === '+201147929010' || s.phone_number === '01147929010');
    }
    
    // If no specific match, try to find any connected session
    if (!targetSession) {
      targetSession = sessions.find(s => s.status === 'connected');
    }
    
    if (!targetSession) {
      console.error('No connected WhatsApp session found');
      return { success: false, message: 'No connected WhatsApp session found' };
    }
    
    if (!targetSession.api_key) {
      console.error('Session API key not available');
      return { success: false, message: 'Session API key not available' };
    }
    
    console.log(`Using session: ${targetSession.name} (${targetSession.phone_number})`);
    
    // Format the phone number properly
    let countryCodeWithout0 = countryCode ? String(countryCode).replace(/^0+/, '') : '20'; // Remove leading zeros, default to 20
    console.log('Country code:', countryCodeWithout0);

    // Clean phone input to digits only
    let cleanedPhone = phoneAsString.replace(/\D/g, '');
    // Remove leading zero from national number (e.g., 010... -> 10...)
    if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.slice(1);

    // Build full international number (without +)
    let phoneNumber = `${countryCodeWithout0}${cleanedPhone}`.replace(/\D/g, '');
    // Ensure leading country indicator '2' for Egypt if missing
    if (!phoneNumber.startsWith('2')) phoneNumber = `2${phoneNumber}`;
    
    // Format for WhatsApp (add @s.whatsapp.net suffix)
    const formattedPhone = `${phoneNumber}@s.whatsapp.net`;
    
    console.log('Sending message to:', formattedPhone);
    
    // Use the session-specific API key to send the message
    const response = await wasender.sendTextMessage(targetSession.api_key, formattedPhone, message);
    
    if (!response.success) {
      console.error(`Failed to send message: ${response.message}`);
      return { success: false, message: `Failed to send message: ${response.message}` };
    }
    
    return { success: true, data: response.data };
  } catch (err) {
    console.error('Error sending WhatsApp message:', err.message);
    return { success: false, message: err.message };
  }
}

// Keep the old function for backward compatibility
async function sendWappiMessage(message, phone, adminPhone, isExcel = false, countryCode = '20') {
  return sendWasenderMessage(message, phone, adminPhone, isExcel, countryCode);
}



const addCardGet = async (req, res) => {
  // Delete EST and SAT advanced students from GTA, Tagamo3, and Online centers
  // await User.deleteMany({
  //   centerName: { $in: ['GTA', 'tagmo3', 'Online'] },
  //   Grade: { $in: ['EST', 'SAT', 'ACT', 'EST2'] },
  //   gradeType:  { $in: ['adv', 'normal'] }
  // }).then((result) => {
  //   console.log(`${result.deletedCount} users deleted.`);
  // }).catch(err => {
  //   console.error('Error deleting users:', err);
  // });
  
  // Function to update Online student codes from O to K
//   const updateOnlineStudentCodes = async () => {
//     try {
//       console.log('Starting to update Online student codes with non-standard format...');
      
//       // Create regex pattern for K prefix followed by more than 4 digits or containing letters
//       const nonStandardCodeRegex = new RegExp('^K(?=.*[a-zA-Z]|.{5,})');
      
//       // Find all Online students with non-standard codes
//       const students = await User.find({ 
//         centerName: 'Online',
//         Code: { $regex: nonStandardCodeRegex }
//       });
      
//       console.log(`Found ${students.length} Online students with non-standard K codes`);
      
//       let updatedCount = 0;
//       let errors = 0;
//       let notificationsSent = 0;
      
//       // Process each student
//       for (const student of students) {
//         try {
//           // Generate a new random 4-digit code
//           const randomNum = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
//           const newCode = 'K' + randomNum.toString();
          
//           // Check if code already exists
//           const existingStudent = await User.findOne({ Code: newCode });
          
//           // If code exists, regenerate until we find a unique one
//           let finalCode = newCode;
//           let attempts = 0;
          
//           while (existingStudent && attempts < 10) {
//             const anotherRandomNum = Math.floor(1000 + Math.random() * 9000);
//             finalCode = 'K' + anotherRandomNum.toString();
//             attempts++;
//             const anotherExistingStudent = await User.findOne({ Code: finalCode });
//             if (!anotherExistingStudent) break;
//           }
          
//           console.log(`Updating student ${student.Username}: ${student.Code} -> ${finalCode}`);
          
//           // Update the student's code
//           await User.updateOne(
//             { _id: student._id },
//             { $set: { Code: finalCode } }
//           );
          
//           // Send a WhatsApp notification to the student if they have a phone number
//           if (student.phone) {
//             try {
//               const message = `مرحباً ${student.Username}،
              
// تم تغيير كود الطالب الخاص بك.
// الكود الجديد: ${finalCode}

// يرجى استخدام هذا الكود الجديد عند التعامل مع المنصة.
// شكراً لتفهمك.`;
              
//               // Use the instanceID3 for Online center (consistent with sendQRCode function)
//               await waziper.sendMessage(
//                 '68555697EE266', // instanceID3 for Online center
//                 `${student.phoneCountryCode || '20'}${student.phone}`,
//                 message
//               );
              
//               notificationsSent++;
//             } catch (notifyError) {
//               console.error(`Failed to notify student ${student.Username} about code change:`, notifyError);
//             }
//           }
          
//           updatedCount++;
//         } catch (error) {
//           console.error(`Error updating student ${student.Username} (${student._id}):`, error);
//           errors++;
//         }
//       }
      
//       console.log(`
// ====== Update Summary ======
// Center: Online
// Non-standard K codes fixed: ${updatedCount} out of ${students.length}
// Notifications sent: ${notificationsSent}
// Errors: ${errors}
// ============================
//       `);
      
//       return { total: students.length, updated: updatedCount, notificationsSent, errors };
//     } catch (error) {
//       console.error('Error updating Online student codes:', error);
//       return { total: 0, updated: 0, notificationsSent: 0, errors: 1 };
//     }
//   };

//   // Uncomment the line below to run the code update when the page loads
// updateOnlineStudentCodes();
  res.render('teacher/addCard', { title: 'addCard', path: req.path });
}

const addCardToStudent = async (req, res) => {
  const { studentCode, assignedCard } = req.body;

  // Check for missing fields
  if (!studentCode || !assignedCard) {
    return res
      .status(400)
      .json({ message: 'studentCode and assignedCard are required' , Username  : null});
  }

  try {
    const userByCode = await User.findOne({ Code: studentCode }, { cardId :1 , Username : 1 , Code : 1 });
    const userHasCard = await User.findOne({ cardId: assignedCard });
    if (!userByCode) {
      return res.status(400).json({ message: 'This student does not exist, please verify the code' ,Username   : ''});
    }

    if(userByCode.cardId){
      return res.status(400).json({ message: 'This student already has a card.' ,Username   : userByCode.Username});
    }

    if (userHasCard) {
      return res.status(400).json({ message: "This card has already been used." ,Username   : `Used by ${userHasCard.Username}`});
    }

    

      await User.updateOne(
        { Code: studentCode },
        {
          cardId: assignedCard,
        }
      ).then((result) => {
        return res.status(200).json({ message: 'تم اضافه الكارت للطالب بنجاح' ,Username   : userByCode.Username});
      }).catch((err) => {
        console.error(err);
        return res.status(500).json({ message: 'يبدو ان هناك خطأ ما ' ,Username   : null});
      });

  } catch (error) {
    console.error('Error adding card:', error);
    return res.status(500).json({ message:'يبدو ان هناك خطأ ما ' ,Username   : null});
  }
};


const markAttendance = async (req, res) => {
  const {
    Grade,
    centerName,
    GroupTime,
    attendId,
    gradeType,
    isSolving,
    attendAbsencet,
    attendOtherGroup,
   HWwithOutSteps,
   attendWithOutHW,
  } = req.body;

  try {

let HWmessage ='';
if(attendWithOutHW){
  HWmessage = '*تم تسجيل حضور الطالب بدون واجب*';
}else if(HWwithOutSteps){
  HWmessage = '*لقد قام الطالب بحل الواجب لكن بدون خطوات*';
}else{
  HWmessage = '*لقد قام الطالب بحل الواجب بالخطوات*';
}
    // Exact matching for attendId - no flexible matching
    const codeParam = String(attendId).trim();
    const orConditions = [
      { cardId: codeParam },  // Search by card ID
      { Code: codeParam }     // Search by exact code match
    ];

    const student = await User.findOne({ $or: orConditions });

    if (!student) {
      return res.status(404).json({ message: 'Student Not found' });
    }

    // Check if student is blocked
    if (student.blocked) {
      return res.status(403).json({ 
        message: 'Student is blocked and cannot attend',
        blockReason: student.blockReason,
        blockedAt: student.blockedAt,
        blockedBy: student.blockedBy
      });
    }

      console.log(student._id);
    // Check if student is in the group
    let group =null;
        if (!attendOtherGroup) {
          group = await Group.findOne({
            CenterName: centerName,
            Grade: Grade,
            GroupTime: GroupTime,
            gradeType: gradeType,
            students: student._id,
          });
        }else{
          group = await Group.findOne({
            CenterName: centerName,
            Grade: Grade,
            GroupTime: GroupTime,
            gradeType: gradeType,
          });
        }

     if (!group) {
            return res
              .status(404)
              .json({ message: 'Student Not Found in This Group' });
     }
    


   let message = '';
    if (student.absences >= 3) {

      if (attendAbsencet){
        student.absences -= 1;
       
      }else{
        return res.status(400).json({
          message: 'Student has already been marked absent 3 times',
        });
      }
      
    }

    // Mark student as present in today's attendance
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo', // Egypt's time zone
    }).format(new Date());




    let attendance = await Attendance.findOne({
        date: today,
        groupId: group._id,
        isSolving: isSolving,
      });
 

    if (!attendance) {
      attendance = new Attendance({
        date: today,
        groupId: group._id,
        studentsPresent: [],
        studentsAbsent: [],
        studentsLate: [],
        isFinalized: false,
        isSolving: isSolving,
      });
    }

  
    // Check if student is already marked as present
    if (attendance.studentsPresent.includes(student._id)) {
      return res
        .status(400)
        .json({ message: 'Student is already marked present' });
    }
    // Check if student is already marked as Late
    if (attendance.studentsLate.includes(student._id)) {
      return res
        .status(400)
        .json({ message: 'Student is already marked Late' });
    }
    if (attendance.studentsExcused.includes(student._id)) {
      return res
        .status(400)
        .json({
          message: 'Student is already marked present From Other Group',
        });
    }



    // Handle if attendance is finalized (late marking logic)
    if (attendance.isFinalized) {
      attendance.studentsAbsent = attendance.studentsAbsent.filter(
        (id) => !id.equals(student._id)
      );
      attendance.studentsLate.push(student._id);

      if (student.absences > 0) {
        student.absences -= 1;
      }

      await attendance.save();

      // Find if an attendance history already exists for today
      const existingHistory = student.AttendanceHistory.find(
        (record) => record.date === today
      );

      if (existingHistory) {
        // Update the status to 'Late' if an entry already exists
        existingHistory.status = 'Late';
        existingHistory.atTime = new Date().toLocaleTimeString();

        // Mark AttendanceHistory as modified to ensure Mongoose updates it
        student.markModified('AttendanceHistory');
      } else {
        // Push a new history entry if it doesn't exist for today
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Late',
        });
      }

      await student.save(); // Save the updated student data

      // Populate the students data for response
      await attendance.populate('studentsLate');
      await attendance.populate('studentsPresent');
      await attendance.populate('studentsExcused');

      let message = '';
      console.log(isSolving);
      if(isSolving == 'true'){
        message = 'تأخر في حضور ال Solving Session';
      }else{
        message = 'تأخر في الحضور ';
      }

      const messageWappi = `⚠️ *عزيزي ولي أمر الطالب ${student.Username}*،\n
      نود إعلامكم بأنه تم التحديث ابنكم قد *${message} اليوم*.\n
      وقد تم تسجيل حضوره *متأخرًا*.\n
      وحضر في جروب *${centerName} - ${Grade} - ${GroupTime}*.\n
      عدد مرات الغياب: *${student.absences}*.\n\n
      *يرجى الانتباه لمواعيد الحضور مستقبلًا*.\n\n
      ${HWmessage}\n
      التاريخ: ${today}
      الوقت: ${new Date().toLocaleTimeString('ar-EG', {timeZone: 'Africa/Cairo'})}
      *شكرًا لتعاونكم.*`;

      // Send the message via the waapi (already present)

    try {
      const sendResult = await sendWappiMessage(messageWappi, student.parentPhone, req.userData.phone, false, student['parentPhoneCountryCode']);
      if (!sendResult.success) {
        console.warn(`Warning: Failed to send WhatsApp message to ${student.Username}'s parent: ${sendResult.message}`);
        // Continue execution even if message sending fails
      }
    } catch (msgErr) {
      console.warn(`Warning: Error sending WhatsApp message to ${student.Username}'s parent: ${msgErr.message}`);
      // Continue execution even if message sending fails
    }


      return res.status(200).json({
        message: 'The Student Marked As Late \n' + message,
        studentsPresent: attendance.studentsPresent,
        studentsLate: attendance.studentsLate,
        studentsExcused: attendance.studentsExcused,
      });
    } else {

          let message = '';
          if (student.absences == 2) {
            message = 'The student has 2 absences and 1 remaining';
          }
          // // Check if student is already marked absent 3 times
          // if (student.absences >= 3) {
          //   return res
          //     .status(400)
          //     .json({
          //       message: 'Student has already been marked absent 3 times',
          //     });
          // }
          let statusMessage =''
          if(attendOtherGroup){
            attendance.studentsExcused.push(student._id);
            statusMessage = 'Present From Other Group'
          }else{

           attendance.studentsPresent.push(student._id);
            statusMessage = 'Present'
          }
          


      await attendance.save();

      // Populate the students data for response
      await attendance.populate('studentsLate');
      await attendance.populate('studentsPresent');
      await attendance.populate('studentsExcused');
      console.log(attendance.studentsExcused);

      if (attendOtherGroup){
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Present From Other Group',
        });
      } else {
        student.AttendanceHistory.push({
          attendance: attendance._id,
          date: today,
          atTime: new Date().toLocaleTimeString(),
          status: 'Present',
        });
      }
  let message2 = '';
  console.log(isSolving);
      if (isSolving=='true') {
        message2 = 'حضر ال Solving Session';
        console.log(message2);
      } else {
        message2 = 'حضر';
        console.log(message2);
      }      

let messageWappi = '';
if(student.centerName==="Online"){
  messageWappi = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم قد *حضر اليوم*.\n
وقد تم تسجيل حضوره *بنجاح*.\n
وحضر في جروب *${centerName} - ${Grade} - ${GroupTime}*.\n
عدد مرات الغياب: *${student.absences}*.\n\n
سيتم ارسال لحضراتكم تقرير عن حالة الطالب خلال الحصة\n
التاريخ: ${today}
الوقت: ${new Date().toLocaleTimeString('ar-EG', {timeZone: 'Africa/Cairo'})}
*شكرًا لتعاونكم.*
Elkably Team`;
}else{
 messageWappi = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم قد *${message2} اليوم في المعاد المحدد*.\n
وقد تم تسجيل حضوره *بنجاح*.\n
وحضر في جروب *${centerName} - ${Grade} - ${GroupTime}*.\n
عدد مرات الغياب: *${student.absences}*.\n
${HWmessage}\n
التاريخ: ${today}
الوقت: ${new Date().toLocaleTimeString('ar-EG', {timeZone: 'Africa/Cairo'})}
*شكرًا لتعاونكم.*
Elkably Team
`;
    
}

      // Send the message via the waapi (already present)
      try {
        const sendResult = await sendWappiMessage(messageWappi, student.parentPhone, req.userData.phone, false, student['parentPhoneCountryCode']);
        if (!sendResult.success) {
          console.warn(`Warning: Failed to send WhatsApp message to ${student.Username}'s parent: ${sendResult.message}`);
          // Continue execution even if message sending fails
        }
      } catch (msgErr) {
        console.warn(`Warning: Error sending WhatsApp message to ${student.Username}'s parent: ${msgErr.message}`);
        // Continue execution even if message sending fails
      }

      await student.save();
      return res.status(200).json({
        message:
          `Attendance marked successfully as ${statusMessage}  \n` + message,
        studentsPresent: attendance.studentsPresent,
        studentsLate: attendance.studentsLate,
        studentsExcused: attendance.studentsExcused,
      });
    }

  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};


const getAttendedUsers = async (req, res) => {
  const { Grade, centerName, GroupTime, attendId, gradeType ,isSolving } = req.body;
  const group = await Group.findOne({
    CenterName: centerName,
    Grade: Grade,
    gradeType : gradeType,
    GroupTime: GroupTime,
  });

  if (!group) {
    return res
      .status(404)
      .json({
        message: 'There are currently no students registered in this group',
      });
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', // Egypt's time zone
  }).format(new Date());

  console.log(today); // Should give you the correct date in 'YYYY-MM-DD' format

  const attendance = await Attendance.findOne({
    groupId: group._id,
    date: today,
    isSolving : isSolving,
  }).populate('studentsPresent studentsLate studentsExcused');
  console.log(attendance);
  if (!attendance) {
    return res
      .status(404)
      .json({ message: 'Attendance records have not been submitted yet' });
  }

  return res.status(200).json({ attendance });
};


const removeAttendance = async (req, res) => {
  const { centerName, Grade, GroupTime, gradeType ,isSolving } = req.body;
  const studentId = req.params.studentId;

  try {
    // Fetch the student
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the group the student belongs to
    const group = await Group.findOne({
      CenterName: centerName,
      Grade: Grade,
      GroupTime: GroupTime,
      gradeType : gradeType,
      students: student._id, // Ensure the student is part of this group
    });

    if (!group) {
      return res
        .status(404)
        .json({ message: 'Student not found in this group' });
    }

    // Find today's attendance for the group
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', // Egypt's time zone
    }).format(new Date());
    const attendance = await Attendance.findOne({
      date: today,
      groupId: group._id,
      isSolving : isSolving,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for today' });
    }

    // Check if the student is in the present or late lists
    const isPresent = attendance.studentsPresent.some((id) =>
      id.equals(student._id)
    );
    const isLate = attendance.studentsLate.some((id) => id.equals(student._id));

    if (!isPresent && !isLate) {
      return res
        .status(400)
        .json({ message: 'Student is not marked as present or late today' });
    }

    // Remove the student from studentsPresent if present
    if (isPresent) {
      attendance.studentsPresent = attendance.studentsPresent.filter(
        (id) => !id.equals(student._id)
      );
    }

    // Remove the student from studentsLate if late
    if (isLate) {
      attendance.studentsLate = attendance.studentsLate.filter(
        (id) => !id.equals(student._id)
      );
    }

    // // Optionally, add the student to studentsAbsent if not already there
    // if (!attendance.studentsAbsent.includes(student._id)) {
    //   attendance.studentsAbsent.push(student._id);
    // }

    // Save the updated attendance record
    await attendance.save();

    // Remove the attendance record from the student's history
    student.AttendanceHistory = student.AttendanceHistory.filter(
      (att) => !att.attendance.equals(attendance._id) // Use .equals() for ObjectId comparison
    );

    await student.save();
    return res.status(200).json({
      message: 'Attendance removed successfully',
      studentsPresent: attendance.studentsPresent,
      studentsLate: attendance.studentsLate,
      studentsAbsent: attendance.studentsAbsent,
    });
  } catch (error) {
    console.error('Error removing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


const updateAmount = async (req, res) => {
  const amountRemaining = req.body.amountRemaining || 0;
  const studentId = req.params.studentId;

  try {
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.amountRemaining = amountRemaining;
    await student.save();
    
    return res.status(200).json({ message: 'Amount updated successfully' });
  }
  catch (error) {
    console.error('Error updating amount:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const finalizeAttendance = async (req, res) => {
  const { centerName, Grade, GroupTime, gradeType, isSolving } = req.body;

  try {
    // Find the group
    const group = await Group.findOne({
      CenterName: centerName,
      Grade: Grade,
      gradeType : gradeType,
      GroupTime: GroupTime,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Find today's attendance record for the group
      const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', // Egypt's time zone
  }).format(new Date());

    let attendance = await Attendance.findOne({
      groupId: group._id,
      date: today,
      isSolving : isSolving,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for today' });
    }

    if (attendance.isFinalized) {
      return res.status(400).json({ message: 'Attendance already finalized' });
    }

    const groupStudentIds = group.students;

    for (const studentId of groupStudentIds) {
  
      const isPresent = attendance.studentsPresent.some((id) =>
        id.equals(studentId)
      );
      const isLate = attendance.studentsLate.some((id) => id.equals(studentId));

      console.log( isPresent , isLate);
      if (!isPresent && !isLate) {
      
        if (!attendance.studentsAbsent.includes(studentId)) {
          attendance.studentsAbsent.push(studentId);

          const student = await User.findById(studentId);
         
          if (student) {
            if(isSolving !=true ){student.absences = (student.absences || 0) + 1;}
            student.AttendanceHistory.push({  
              attendance: attendance._id,
              date: today,
              atTime : new Date().toLocaleTimeString(),
              status: 'Absent',
            });
            await student.save();
          }
        }
      }
    }

    attendance.isFinalized = true;
    await attendance.save();
    await attendance.populate('studentsAbsent');
    await attendance.populate('studentsPresent');
    await attendance.populate('studentsExcused');
 
  

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Data');

    // Add title row
    const titleRow = worksheet.addRow(['Attendance Report']);
    titleRow.font = { size: 27, bold: true };
    worksheet.mergeCells('A1:H1');
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add group info
    const groupInfoRow = worksheet.addRow([
      'Grade',
      'Center Name',
      'Group Time',
      'Date',
    ]);
    groupInfoRow.font = { bold: true };

    worksheet.addRow([Grade, centerName, GroupTime, today]);

    // Add present students section
    let row = worksheet.addRow([]);
    row = worksheet.addRow(['Present Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c = 0;
    let totalAmount = 0;
    let totalAmountRemaining = 0;

    attendance.studentsPresent.forEach(async(student) => {
      c++;
      const row = worksheet.addRow([
        c,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount += student.balance;
      totalAmountRemaining += student.amountRemaining;

      if (c % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }

    });

    // Add total row for Present Students
    const totalRowPresent = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount,
      totalAmountRemaining,
    ]);
    totalRowPresent.font = { bold: true };
    totalRowPresent.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add present Other Group students section
    row = worksheet.addRow(['Present From Other Group Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow3 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
      'Group Info' ,
    ]);
    headerRow3.font = { bold: true };
    headerRow3.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c3 = 0;
    let totalAmount3 = 0;
    let totalAmountRemaining3 = 0;

    attendance.studentsExcused.forEach(async(student) => {
      c3++;
      const row = worksheet.addRow([
        c3,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
        `${student.centerName} - ${student.Grade} - ${student.gradeType} - ${student.groupTime}`,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount3 += student.balance;
      totalAmountRemaining3 += student.amountRemaining;

      if (c3 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }

// const messageWappi = `✅ *عزيزي ولي أمر الطالب ${student.Username}*،\n
// نود إعلامكم بأن ابنكم قد *حضر اليوم في المعاد المحدد*.\n
// وقد تم تسجيل حضوره *بنجاح*.\n
// المبلغ المتبقي من سعر الحصة هو: *${student.amountRemaining} جنيه*.\n
// عدد مرات الغياب: *${student.absences}*.\n\n
// *شكرًا لتعاونكم.*`;


//       // Send the message via the waapi (already present)
//       await sendWappiMessage(messageWappi, student.parentPhone,req.userData.phone);



    });

    // Add total row for Present Other Group  Students
    const totalRowPresent3 = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount3,
      totalAmountRemaining3,
    ]);
    totalRowPresent3.font = { bold: true };
    totalRowPresent3.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent3.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent3.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add absent students section
    row = worksheet.addRow(['Absent Students']);
    row.font = { bold: true, size: 16, color: { argb: 'FF0000' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add absent students data
    const headerRow2 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow2.font = { bold: true };
    headerRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    let c2 = 0;
    attendance.studentsAbsent.forEach(async(student) => {
      c2++;
      const row = worksheet.addRow([
        c2,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };


      if (c2 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }



let subMessage = '';
if (student.absences >= 3) {
  subMessage = `\n\n❌ *وفقًا لعدد مرات الغياب التي تم تسجيلها لابنكم*، يرجى العلم أنه *لن يتمكن من دخول الحصة القادمة*.`;
}
let subMessage2 = '';
if(isSolving=='true'){

  subMessage2 = 'في Solving Session';
}

const messageWappi = `❌ *عزيزي ولي أمر الطالب ${student.Username}*،\n
نود إعلامكم بأن ابنكم *لم يحضر ${subMessage2} اليوم*.\n
وقد تم تسجيل غيابه .\n
عدد مرات الغياب: *${student.absences}*.${subMessage}\n\n
*شكرًا لتعاونكم.*`;
 

      // Send the message via the waapi (already present)
      try {
        const sendResult = await sendWappiMessage(messageWappi, student.parentPhone, req.userData.phone, false, student['parentPhoneCountryCode']);
        if (!sendResult.success) {
          console.warn(`Warning: Failed to send WhatsApp message to ${student.Username}'s parent: ${sendResult.message}`);
          // Continue execution even if message sending fails
        }
      } catch (msgErr) {
        console.warn(`Warning: Error sending WhatsApp message to ${student.Username}'s parent: ${msgErr.message}`);
        // Continue execution even if message sending fails
      }

 

    });

 

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx'
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error finalizing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// =================================================== END Add Card  &&  Attendance =================================================== //



// =================================================== Handel Attendance =================================================== //

const handelAttendanceGet = async (req, res) => {
 
  res.render('teacher/handelAttendance', { title: 'handelAttendance', path: req.path });
}


const getDates = async (req, res) => {
  const { Grade, centerName, GroupTime, gradeType, isSolving } = req.body;
  console.log(Grade, centerName, GroupTime);
  try {
    const group = await Group.findOne({ Grade, CenterName: centerName, GroupTime , gradeType });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const attendanceRecords = await Attendance.find({
      groupId: group._id,
      isSolving,
    });
    console.log(attendanceRecords);
    if (!attendanceRecords) {
      return res.status(404).json({ message: 'No attendance records found for this session.' });
    }

    const dates = attendanceRecords.map((record) => record.date);
    res.status(200).json({ Dates: dates });
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }

}

const getAttendees = async (req, res) => {
    const { Grade, centerName, GroupTime, gradeType, date, isSolving } =
      req.body;

      console.log(Grade, centerName, GroupTime , gradeType, date, isSolving);
    try {
      const group = await Group.findOne({
        Grade,
        CenterName: centerName,
        GroupTime,
        gradeType,
      });

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      const attendance = await Attendance.findOne({
        groupId: group._id,
        date,
        isSolving,
      }).populate(
        'studentsPresent studentsAbsent studentsLate studentsExcused'
      );

      if (!attendance) {
        return res.status(404).json({ message: 'No attendance record found for this session.' });
      }

      res.status(200).json({ attendance , message: 'Attendance record found successfully' });
    } catch (error) {
      console.error('Error fetching attendees:', error);
      res.status(500).json({ message: 'Server error. Please try again.' });

}

}

const convertAttendeesToExcel = async (req, res) => {
  const { centerName, Grade, GroupTime, gradeType, isSolving, date } = req.body;
  console.log(centerName, Grade, GroupTime, gradeType, isSolving);
  try {
    // Find the group
    const group = await Group.findOne({
      CenterName: centerName,
      Grade: Grade,
      GroupTime: GroupTime,
      gradeType: gradeType,
    });
    console.log(group);
    if (!group) {
      throw new Error('Group not found');
    }

    // Find today's attendance record for the group
    // const today = new Intl.DateTimeFormat('en-CA', {
    //   timeZone: 'Africa/Cairo', // Egypt's time zone
    // }).format(new Date());

    let attendance = await Attendance.findOne({
      groupId: group._id,
      date: date,
      isSolving,
    }).populate('studentsPresent studentsAbsent studentsLate studentsExcused');

    console.log(attendance);

    if (!attendance) {
      return res
        .status(404)
        .json({ message: 'No attendance record found for today' });
    }

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Data');

    // Add title row
    const titleRow = worksheet.addRow(['Attendance Report']);
    titleRow.font = { size: 27, bold: true };
    worksheet.mergeCells('A1:H1');
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add group info
    const groupInfoRow = worksheet.addRow([
      'Grade',
      'Center Name',
      'Group Time',
      'Date',
    ]);
    groupInfoRow.font = { bold: true };

    worksheet.addRow([Grade, centerName, GroupTime, date]);

    // Add present students section
    let row = worksheet.addRow([]);
    row = worksheet.addRow(['Present Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c = 0;
    let totalAmount = 0;
    let totalAmountRemaining = 0;

    attendance.studentsPresent.forEach((student) => {
      c++;
      const row = worksheet.addRow([
        c,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount += student.balance;
      totalAmountRemaining += student.amountRemaining;

      if (c % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add total row for Present Students
    const totalRowPresent = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount,
      totalAmountRemaining,
    ]);
    totalRowPresent.font = { bold: true, size: 15 };
    totalRowPresent.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add absent students section
    row = worksheet.addRow(['Absent Students']);
    row.font = { bold: true, size: 16, color: { argb: 'FF0000' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add absent students data
    const headerRow2 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow2.font = { bold: true };
    headerRow2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    let c2 = 0;

    attendance.studentsAbsent.forEach((student) => {
      c2++;
      const row = worksheet.addRow([
        c2,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      if (c2 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add late students section
    row = worksheet.addRow(['Late Students']);
    row.font = { bold: true, size: 16, color: { argb: 'FFA500' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add late students data
    const headerRow3 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);
    headerRow3.font = { bold: true };
    headerRow3.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    let c3 = 0;
    let totalAmountLate = 0;
    let totalAmountRemainingLate = 0;

    attendance.studentsLate.forEach((student) => {
      c3++;
      const row = worksheet.addRow([
        c3,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmountLate += student.balance;
      totalAmountRemainingLate += student.amountRemaining;

      if (c3 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }
    });

    // Add total row for Late Students
    const totalRowLate = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmountLate,
      totalAmountRemainingLate,
    ]);
    totalRowLate.font = { bold: true, size: 15 };
    totalRowLate.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowLate.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowLate.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add present Other Group students section
    row = worksheet.addRow(['Present From Other Group Students']);
    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };
    worksheet.mergeCells(`A${row.number}:H${row.number}`);
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add present students data
    const headerRow4 = worksheet.addRow([
      '#',
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
      'Group Info',
    ]);
    headerRow4.font = { bold: true };
    headerRow4.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    let c4 = 0;
    let totalAmount4 = 0;
    let totalAmountRemaining4 = 0;

    attendance.studentsExcused.forEach(async (student) => {
      c4++;
      const row = worksheet.addRow([
        c4,
        student.Username,
        student.Code,
        student.phone,
        student.parentPhone,
        student.absences,
        student.balance,
        student.amountRemaining,
        `${student.centerName} - ${student.Grade} - ${student.gradeType} - ${student.groupTime}`,
      ]);
      row.font = { size: 13 };

      // Add values to totals
      totalAmount4 += student.balance;
      totalAmountRemaining4 += student.amountRemaining;

      if (c4 % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'DDDDDD' },
        };
      }

    });

    // Add total row for Present Other Group  Students
    const totalRowPresent4 = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'Total',
      totalAmount4,
      totalAmountRemaining4,
    ]);
    totalRowPresent4.font = { bold: true };
    totalRowPresent4.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent4.getCell(7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };
    totalRowPresent4.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx'
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error finalizing attendance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// =================================================== END Handel Attendance =================================================== //



// =================================================== My Student Data =================================================== //

const getStudentData = async (req, res) => {
  const studentCode = req.params.studentCode;
  const { start, end } = req.query; // Extract start and end dates from query parameters

  try {
    // Find student based on the provided code with exact matching
    const student = await User.findOne({ Code: studentCode.trim() });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    let attendanceHistory = student.AttendanceHistory;

    // Filter attendance based on date range if provided
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      attendanceHistory = attendanceHistory.filter((record) => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    // Build a response object with relevant fields and filtered attendance history
    const studentData = {
      Code: student.Code,
      Username: student.Username,
      centerName: student.centerName,
      groupTime: student.groupTime,
      phone: student.phone,
      parentPhone: student.parentPhone,
      absences: student.absences,
      balance: student.balance,
      amountRemaining: student.amountRemaining,
      attendanceHistory: attendanceHistory.map((record) => ({
        date: record.date,
        status: record.status,
        time: record.atTime,
      })), // Map attendance history for easy response format
    };
    console.log(studentData);
    // Return the student data in the response
    res.status(200).json(studentData);
  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Advanced search for a student by code with detailed information
const advancedStudentSearch = async (req, res) => {
  const { code } = req.params;
  
  try {
    // Use exact matching for the code - no flexible matching
    const codeParam = String(code).trim();
    
    // Build query conditions for exact matching only
    const orConditions = [
      { cardId: codeParam },  // Search by card ID
      { Code: codeParam }     // Search by exact code match
    ];

    // Find the student with exact code match
    const student = await User.findOne({ $or: orConditions });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the student's group information
    let groupInfo = null;
    if (student.centerName && student.Grade && student.gradeType && student.groupTime) {
      const group = await Group.findOne({
        CenterName: student.centerName,
        Grade: student.Grade,
        gradeType: student.gradeType,
        GroupTime: student.groupTime
      });
      
      if (group) {
        groupInfo = {
          id: group._id,
          displayText: group.displayText || group.GroupTime,
          studentCount: group.students ? group.students.length : 0
        };
      }
    }

    // Build a comprehensive response with all student details
    const studentData = {
      _id: student._id,
      Username: student.Username,
      Code: student.Code,
      phone: student.phone,
      parentPhone: student.parentPhone,
      centerName: student.centerName,
      Grade: student.Grade,
      gradeType: student.gradeType,
      groupTime: student.groupTime,
      balance: student.balance,
      amountRemaining: student.amountRemaining,
      absences: student.absences,
      attendingType: student.attendingType,
      GradeLevel: student.GradeLevel,
      bookTaken: student.bookTaken,
      schoolName: student.schoolName,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      blocked: student.blocked,
      blockReason: student.blockReason,
      blockedAt: student.blockedAt,
      blockedBy: student.blockedBy,
      groupInfo
    };

    res.status(200).json(studentData);
  } catch (error) {
    console.error('Error in advanced student search:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


const fs = require('fs');
const path = require('path');

// Define a directory where reports will be stored
const reportsDirectory = path.join(__dirname, 'attendance_reports');

// Ensure the directory exists
if (!fs.existsSync(reportsDirectory)) {
  fs.mkdirSync(reportsDirectory);
}

const convertAttendaceToExcel = async (req, res) => {
  const studentCode = req.params.studentCode;
  console.log(studentCode);
  try {
    // Find student based on the provided code
    const student = await User.findOne({ Code: studentCode });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const workbook = new Excel.Workbook();

    const worksheet = workbook.addWorksheet('Attendance Data');

    // Add title row
    const titleRow = worksheet.addRow(['Attendance Report']);

    titleRow.font = { size: 27, bold: true };

    worksheet.mergeCells('A1:H1');

    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add student info
    const studentInfoRow = worksheet.addRow([
      'Student Name',
      'Student Code',
      'Phone',
      'Parent Phone',
      'Absences',
      'Amount',
      'Amount Remaining',
    ]);

    studentInfoRow.font = { bold: true };

    worksheet.addRow([
      student.Username,
      student.Code,
      student.phone,
      student.parentPhone,
      student.absences,
      student.balance,
      student.amountRemaining,
    ]);

    // Add attendance history section
    let row = worksheet.addRow([]);

    row = worksheet.addRow(['Attendance History']);

    row.font = { bold: true, size: 16, color: { argb: 'ff1aad00' } };

    worksheet.mergeCells(`A${row.number}:H${row.number}`);

    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add attendance history data

    const headerRow = worksheet.addRow(['Date', 'Status', 'Time']);

    headerRow.font = { bold: true };

    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    student.AttendanceHistory.forEach((record) => {
      const row = worksheet.addRow([record.date, record.status, record.atTime]);
      row.font = { size: 13 };
    });

    // Add borders to all cells

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
  const buffer = await workbook.xlsx.writeBuffer(); // Generates buffer from workbook
  const base64Excel = buffer.toString('base64'); 
    // Define the file path to save the report locally
    const fileName = `${studentCode}_attendance.xlsx`;
    const filePath = path.join(reportsDirectory, fileName);

    // Save the Excel file to the local filesystem
    await workbook.xlsx.writeFile(filePath);

    // Create a public URL to the file (you may need to expose the directory statically)
    const fileUrl = `${req.protocol}://${req.get(
      'host'
    )}/attendance_reports/${fileName}`;

    // Use WhatsApp API to send the URL

    // await sendWappiMessage(fileUrl, student.parentPhone,req.userData.phone);

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance_data.xlsx'
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error converting attendance to Excel:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =================================================== END My Student Data =================================================== //


// =================================================== Whats App =================================================== //



const whatsApp_get = async (req,res)=>{
  // console.log('whatsApp_get');
  //   const updateStudentCodes = async () => {
  //   try {
  //     // Find all users (students)
  //     const students = await User.find({});
  //     let updatedCount = 0;
  //     console.log(students);
  //     for (const student of students) {
  //       console.log(student.Code);
  //       // Skip if code is already prefixed with 'G'
  //       if (student.Code && student.Code.startsWith('G')&& student.centerName==="tagmo3") {
  //         // remove 'G' from the start of the code
  //         student.Code = student.Code.replace('G', '');
          
  //         await student.save();
  //         updatedCount++;
  //         console.log(`Updated student code for ${student.Username} to ${student.Code} ${student.centerName}`);
  //       }
  //     }
      
  //     console.log(`${updatedCount} student codes have been updated successfully`);
  //   } catch (error) {
  //     console.error('Error updating student codes:', error);
  //   }
  // };
  
  // // Uncomment the line below to run the code update function
  // await updateStudentCodes();

  res.render('teacher/whatsApp', { title: 'whatsApp', path: req.path });
}


const sendGradeMessages = async (req, res) => {
  const {
    phoneCloumnName,
    gradeCloumnName,
    nameCloumnName,
    studentPhoneColumnName,
    sendToStudents,
    dataToSend,
    quizName,
    maxGrade,
  } = req.body;

  let n = 0;
  req.io.emit('sendingMessages', {
    nMessages: n,
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of dataToSend) {
      const grade = student[gradeCloumnName] ?? 0; // Default grade to 0 if undefined or null
      const parentPhone = student[phoneCloumnName];
      const studentPhone = studentPhoneColumnName ? student[studentPhoneColumnName] : null;
      const name = student[nameCloumnName];

      console.log(quizName, student, grade, parentPhone, studentPhone);

      let message = `
السلام عليكم 
مع حضرتك assistant mr kably EST/ACT math teacher 
برجاء العلم ان تم حصول الطالب ${name} على درجة (${grade}) من (${maxGrade}) في (${quizName}) 
      `;

      // Send to parents
      if (parentPhone) {
        try {
          await sendWappiMessage(message, parentPhone, req.userData.phone, true)
            .then(() => {
              req.io.emit('sendingMessages', {
                nMessages: ++n,
              });
              console.log(`Message sent successfully to parent of ${name}`);
            });
        } catch (err) {
          console.error(`Error sending message to parent of ${name}:`, err);
        }
      }

      // Send to students if enabled and phone exists
      if (sendToStudents && studentPhone) {
        try {
          await sendWappiMessage(message, studentPhone, req.userData.phone, true)
            .then(() => {
              req.io.emit('sendingMessages', {
                nMessages: ++n,
              });
              console.log(`Message sent successfully to student ${name}`);
            });
        } catch (err) {
          console.error(`Error sending message to student ${name}:`, err);
        }
      }

      // Introduce a random delay between 1 and 5 seconds
      const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000;
      console.log(
        `Delaying for ${
          randomDelay / 1000
        } seconds before sending the next message.`
      );
      await delay(randomDelay);
    }

    res.status(200).json({ message: 'Messages sent successfully' });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const sendMessages = async (req, res) => {
  const { phoneCloumnName, nameCloumnName, dataToSend, HWCloumnName  } =
    req.body;

  let n = 0;
  req.io.emit('sendingMessages', {
    nMessages: n,
  });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of dataToSend) {
      let msg = '';
      console.log(student[HWCloumnName]);
      if (!student[HWCloumnName]) {
        msg = `لم يقم الطالب ${student[nameCloumnName]} بحل واجب حصة اليوم`;
      } else {
        msg = `لقد قام الطالب ${student[nameCloumnName]} بحل واجب حصة اليوم`;
      }

      let theMessage = `
السلام عليكم 
مع حضرتك assistant mr kably EST/ACT math teacher 
${msg}
      `;

      try {
        await sendWappiMessage(theMessage, student[phoneCloumnName],req.userData.phone,true)
        .then(() => {
          req.io.emit('sendingMessages', {
            nMessages: ++n,
          });
          console.log(`Message sent successfully to ${student[nameCloumnName]}`);
        })
        
      
        } catch (err) {
        console.error(
          `Error sending message to ${student[nameCloumnName]}:`,
          err
        );
      }

      // Introduce a random delay between 1 and 10 seconds
      const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000;
      console.log(
        `Delaying for ${
          randomDelay / 1000
        } seconds before sending the next message.`
      );
      await delay(randomDelay);
    }

    res.status(200).json({ message: 'Messages sent successfully' });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const sendGeneralMessages = async (req, res) => {
  const { 
    phoneStudentColumnName, 
    phoneParentColumnName, 
    nameColumnName, 
    messageContent, 
    sendTarget, 
    dataToSend 
  } = req.body;

  let n = 0;
  const errorNumbers = [];
  req.io.emit('sendingMessages', { nMessages: n });

  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of dataToSend) {
      const studentName = student[nameColumnName];
      // Replace {name} placeholder with actual student name
      let personalizedMessage = messageContent.replace(/{name}/g, studentName);
      
      let theMessage = `
السلام عليكم 
مع حضرتك assistant mr kably EST/ACT math teacher 
${personalizedMessage}
      `;

      // Send to parents if selected
      if (sendTarget === 'parents' || sendTarget === 'both') {
        const parentPhone = student[phoneParentColumnName];
        if (parentPhone) {
          try {
            await sendWappiMessage(theMessage, parentPhone, req.userData.phone, true);
            req.io.emit('sendingMessages', { nMessages: ++n });
            console.log(`Message sent to parent of ${studentName}`);
          } catch (err) {
            console.error(`Error sending message to parent of ${studentName}:`, err);
            errorNumbers.push(parentPhone);
          }
        }
      }

      // Send to students if selected
      if (sendTarget === 'students' || sendTarget === 'both') {
        const studentPhone = student[phoneStudentColumnName];
        if (studentPhone) {
          try {
            await sendWappiMessage(theMessage, studentPhone, req.userData.phone, true);
            req.io.emit('sendingMessages', { nMessages: ++n });
            console.log(`Message sent to student ${studentName}`);
          } catch (err) {
            console.error(`Error sending message to student ${studentName}:`, err);
            errorNumbers.push(studentPhone);
          }
        }
      }

      // Introduce a random delay between 1 and 5 seconds
      const randomDelay = Math.floor(Math.random() * 4000) + 1000;
      console.log(`Delaying for ${randomDelay / 1000} seconds before sending the next message.`);
      await delay(randomDelay);
    }

    res.status(200).json({ 
      message: errorNumbers.length > 0 ? 'Messages sent with some errors' : 'Messages sent successfully',
      errors: errorNumbers.length > 0 ? errorNumbers : undefined
    });
  } catch (error) {
    console.error('Error sending general messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



// =================================================== END Whats App =================================================== //



// =================================================== Whats app 2 =================================================== //


const whatsApp2_get = (req, res) => {
  res.render('teacher/whatsApp2', { title: 'whatsApp2', path: req.path });
}

const getDataStudentInWhatsApp = async (req, res) => {
  const {centerName,Grade,gradeType,groupTime} = req.query 
  try {
    const group = await Group.findOne({CenterName:centerName,Grade,gradeType,GroupTime:groupTime}).populate('students')
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const students = group.students;
    res.status(200).json({ students });
  }
  catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }

}

const submitData = async (req, res) => {
  const { data, option, quizName, maxGrade, centerName, Grade, gradeType, groupTime, messageContent, sendTarget } = req.body;
  let n = 0;
  const errorNumbers = [];
  const studentsIds = [];
  req.io.emit('sendingMessages', { nMessages: n });

  console.log(data);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getMessage = (student) => {
    if (option === 'HWStatus') {
      if (student.hwStatus === 'yes' || student.hwStatus === 'no') studentsIds.push(student.studentId);
      return student.hwStatus === 'no'
        ? `
السلام عليكم   
مع حضرتك Assistant Mr Kably، EST/ACT  Math Teacher .

نود إعلامكم بأن الطالب *${student.studentName}* قد حضر حصة اليوم ولكنه لم يقم بحل واجب الحصة.

نرجو منكم متابعة الطالب لحل الواجبات لضمان تحقيق أفضل النتائج.

شكراً لتعاونكم.
      `
        : student.hwStatus === 'none'
        ? `
السلام عليكم   
مع حضرتك Assistant Mr Kably، EST/ACT EST/ACT Math Teacher.

نود إعلامكم بأن الطالب *${student.studentName}* لم يحضر اليوم ولم يقم بعمل الواجب.

نرجو منكم متابعة الطالب لضمان تحقيق أفضل النتائج.

شكراً لتعاونكم.
      `
        : `
السلام عليكم   
مع حضرتك Assistant Mr Kably، EST/ACT Math Teacher.

نود إعلامكم بأن الطالب *${
            student.studentName
          }* قد حضر حصة اليوم وقام بحل واجب الحصة.

${
  student.solvStatus === 'true'
    ? 'كما قام بحل الواجب بالخطوات.'
    : 'ولكن لم يقم بحل الواجب بالخطوات.'
}

شكراً لتعاونكم.
      `;
    }

    if (option === 'gradeMsg') {
      return student.grade
        ? `
السلام عليكم
مع حضرتك Assistant Mr Kably EST/ACT Math Teacher
برجاء العلم ان تم حصول الطالب ${student.studentName} على درجة (${student.grade}) من (${maxGrade}) في (${quizName})
`
        : `
السلام عليكم
مع حضرتك Assistant Mr Kably EST/ACT Math Teacher
برجاء العلم ان الطالب ${student.studentName} لم يقم بحضور امتحان (${quizName}) بتاريخ ${new Date().toLocaleDateString()}
`;
    }

    if (option === 'sendMsg') {
      // Replace {name} placeholder with actual student name
      let message = messageContent.replace(/{name}/g, student.studentName);
      return `
السلام عليكم
مع حضرتك Assistant Mr Kably EST/ACT Math Teacher

${message}
      `;
    }
  };

  try {
    for (const student of data) {
      const message = getMessage(student);
      
      if (option === 'sendMsg') {
        // Handle different send targets for general messages
        if (sendTarget === 'parents' || sendTarget === 'both') {
          try {
            await sendWappiMessage(message, student.parentPhone, req.userData.phone);
            req.io.emit('sendingMessages', { nMessages: ++n });
            console.log(`Message sent to parent of ${student.studentName}`);
          } catch (err) {
            console.error(`Error sending message to parent of ${student.studentName}:`, err);
            errorNumbers.push(student.parentPhone);
          }
        }
        
        if ((sendTarget === 'students' || sendTarget === 'both') && student.phone) {
          try {
            await sendWappiMessage(message, student.phone, req.userData.phone);
            req.io.emit('sendingMessages', { nMessages: ++n });
            console.log(`Message sent to student ${student.studentName}`);
          } catch (err) {
            console.error(`Error sending message to student ${student.studentName}:`, err);
            errorNumbers.push(student.phone);
          }
        }
      } else {
        // Handle grade messages with optional student phone
        if (option === 'gradeMsg') {
          // Send to parents
          try {
            await sendWappiMessage(message, student.parentPhone, req.userData.phone);
            req.io.emit('sendingMessages', { nMessages: ++n });
            console.log(`Message sent to parent of ${student.studentName}`);
          } catch (err) {
            console.error(`Error sending message to parent of ${student.studentName}:`, err);
            errorNumbers.push(student.parentPhone);
          }
          
          // Send to students if enabled and phone exists
          if (student.sendToStudents === 'true' && student.studentPhone) {
            try {
              await sendWappiMessage(message, student.studentPhone, req.userData.phone);
              req.io.emit('sendingMessages', { nMessages: ++n });
              console.log(`Message sent to student ${student.studentName}`);
            } catch (err) {
              console.error(`Error sending message to student ${student.studentName}:`, err);
              errorNumbers.push(student.studentPhone);
            }
          }
        } else {
          // Original behavior for other message types
          try {
            await sendWappiMessage(message, student.parentPhone, req.userData.phone);
            req.io.emit('sendingMessages', { nMessages: ++n });
            console.log(`Message sent successfully to ${student.studentName}`);
          } catch (err) {
            console.error(`Error sending message to ${student.studentName}:`, err);
            errorNumbers.push(student.parentPhone);
          }
        }
      }

      const randomDelay = Math.floor(Math.random() * 4000) + 1000;
      console.log(`Delaying for ${randomDelay / 1000} seconds`);
      await delay(randomDelay);
    }

    // Mark attendance (only for HWStatus option)
    if (option === 'HWStatus' && studentsIds.length > 0) {
      const group = await Group.findOne({ CenterName: centerName, Grade, GroupTime: groupTime, gradeType });
      if (group) {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
        let attendance = await Attendance.findOne({ groupId: group._id, date: today, isSolving: false }) ||
                         new Attendance({ groupId: group._id, date: today, isSolving: false });
        
        attendance.studentsPresent = studentsIds;
        await attendance.save();
      }
    }

    res.status(200).json({
      message: errorNumbers.length > 0 ? 'Messages sent with some errors' : 'Messages sent successfully',
      errors: errorNumbers.length > 0 ? errorNumbers : undefined,
    });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



// =================================================== END Whats app 2 =================================================== //

// =================================================== Convert Group =================================================== //


const convertGroup_get = (req, res) => {
  res.render('teacher/convertGroup', { title: 'convertGroup', path: req.path });
}

const getDataToTransferring = async (req, res) => {
  const { Code } = req.params;

  try {
    const codeParam = String(Code).trim();
    
    // Build search conditions for exact matching only
    const orConditions = [
      { cardId: codeParam },  // Search by card ID
      { Code: codeParam }     // Search by exact code match
    ];

    const student = await User.findOne({ $or: orConditions });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const groups = await Group.find({ Grade: student.Grade, CenterName: student.centerName, gradeType: student.gradeType });

    if (!groups) {
      return res.status(404).json({ message: 'No groups found for this student' });
    }

    res.status(200).json(student);
  }
  catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
}

const transferStudent = async (req, res) => {
  const {  centerName, Grade, gradeType, groupTime } = req.body;
  const { Code } = req.params;
  console.log(req.body)
  try {
    const codeParam = String(Code).trim();
    
    // Build search conditions for exact matching only
    const orConditions = [
      { cardId: codeParam },  // Search by card ID
      { Code: codeParam }     // Search by exact code match
    ];

    const student = await User.findOne({ $or: orConditions });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const group = await Group.findOne({
      Grade,
      CenterName: centerName,
      GroupTime: groupTime,
      gradeType,
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the student is already in the target group
    if (group.students.includes(student._id)) {
      return res.status(400).json({ message: 'Student is already in the target group' });
    }

    // Remove the student from any previous group FIRST
    await Group.updateMany(
      { students: student._id },
      { $pull: { students: student._id } }
    );

    // Update the student's group info
    student.centerName = centerName;
    student.Grade = Grade;
    student.gradeType = gradeType;
    student.groupTime = groupTime;
    await student.save();

    // Add the student to the new group
    await Group.findByIdAndUpdate(
      group._id,
      { $addToSet: { students: student._id } } // Use $addToSet to prevent duplicates
    );

    res.status(200).json({ message: 'Student transferred successfully' });
  } catch (error) {
    console.error('Error transferring student:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// =================================================== Edit Groups (Management) =================================================== //

const editGroups_get = async (req, res) => {
  res.render('teacher/editGroups', { title: 'Edit Groups', path: req.path });
};

// Get hierarchical options for selects across pages (from Group model)
const getGroupOptions = async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true }).select('CenterName Grade gradeType GroupTime displayText').lean();

    const centersSet = new Set();
    const centerToGrades = {}; // centerName -> Set of Grades
    const gradeToTypes = {}; // Grade -> Set of gradeTypes
    const timesTree = {}; // centerName -> Grade -> gradeType -> [{value,text}]

    for (const g of groups) {
      centersSet.add(g.CenterName);

      if (!centerToGrades[g.CenterName]) centerToGrades[g.CenterName] = new Set();
      centerToGrades[g.CenterName].add(g.Grade);

      if (!gradeToTypes[g.Grade]) gradeToTypes[g.Grade] = new Set();
      gradeToTypes[g.Grade].add(g.gradeType);

      if (!timesTree[g.CenterName]) timesTree[g.CenterName] = {};
      if (!timesTree[g.CenterName][g.Grade]) timesTree[g.CenterName][g.Grade] = {};
      if (!timesTree[g.CenterName][g.Grade][g.gradeType]) timesTree[g.CenterName][g.Grade][g.gradeType] = [];
      timesTree[g.CenterName][g.Grade][g.gradeType].push({ value: g.GroupTime, text: g.displayText || g.GroupTime });
    }

    const centers = Array.from(centersSet);
    const centerNames = {};
    for (const center of centers) {
      centerNames[center] = Array.from(centerToGrades[center] || []).map((gr) => ({ value: gr, text: gr }));
    }

    const gradeTypeOptions = {};
    for (const gr of Object.keys(gradeToTypes)) {
      gradeTypeOptions[gr] = Array.from(gradeToTypes[gr]).map((t) => ({ value: t, text: t }));
    }

    res.status(200).json({ centers, centerNames, gradeTypeOptions, groupTimes: timesTree });
  } catch (error) {
    console.error('Error building group options:', error);
    res.status(500).json({ message: 'Failed to load group options' });
  }
};

// List Groups with counts
const listRegisterGroups = async (req, res) => {
  try {
    const items = await Group.aggregate([
      { $match: {} },
      { $project: { CenterName: 1, Grade: 1, gradeType: 1, GroupTime: 1, displayText: 1, isActive: 1, createdAt: 1, studentsCount: { $size: { $ifNull: ['$students', []] } } } },
      { $sort: { CenterName: 1, Grade: 1, gradeType: 1, GroupTime: 1 } }
    ]);
    res.status(200).json({ items });
  } catch (error) {
    console.error('Error listing groups:', error);
    res.status(500).json({ message: 'Failed to list groups' });
  }
};

// List users not assigned to any group (not present in any Group.students)
const listStudentsWithoutGroup = async (req, res) => {
  try {
    const { centerName, Grade, gradeType } = req.query;

    // Collect all student ObjectIds that are members of any group
    const groups = await Group.find({}).select('students').lean();
    const assignedIdsSet = new Set();
    for (const g of groups) {
      if (Array.isArray(g.students)) {
        for (const s of g.students) assignedIdsSet.add(String(s));
      }
    }

    const filter = {};
    if (centerName) filter.centerName = centerName;
    if (Grade) filter.Grade = Grade;
    if (gradeType) filter.gradeType = gradeType;

    // Users whose _id not in assigned set
    const users = await User.find(filter)
      .select('Username Code phone parentPhone centerName Grade gradeType groupTime createdAt updatedAt')
      .lean();

    const unassigned = users.filter(u => !assignedIdsSet.has(String(u._id)));

    res.status(200).json({ count: unassigned.length, students: unassigned });
  } catch (error) {
    console.error('Error listing students without group:', error);
    res.status(500).json({ message: 'Failed to load students without group' });
  }
};

const createRegisterGroup = async (req, res) => {
  try {
    const { centerName, Grade, gradeType, groupTime, displayText, isActive } = req.body;
    if (!centerName || !Grade || !gradeType || !groupTime || !displayText) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const allowedCenters = new Set(['GTA', 'tagmo3', 'Online']);
    if (!allowedCenters.has(centerName)) {
      return res.status(400).json({ message: 'Center must be one of GTA, tagmo3, Online' });
    }
    const item = await Group.create({ CenterName: centerName, Grade, gradeType, GroupTime: groupTime, displayText, isActive });
    res.status(201).json({ item: { ...item.toObject(), studentsCount: (item.students || []).length } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A group with the same Center, Grade, Type and Group Key already exists' });
    }
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
};

// For safety, restrict edits; allow only displayText/isActive updates
const updateRegisterGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayText, isActive } = req.body;
    const item = await Group.findByIdAndUpdate(id, { displayText, isActive }, { new: true });
    if (!item) return res.status(404).json({ message: 'Group not found' });
    res.status(200).json({ item: { ...item.toObject(), studentsCount: (item.students || []).length } });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
};

const deleteRegisterGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Professional note: deleting a group will completely remove all students from this group
    // from the entire system, including their attendance records and group affiliation.

    // 1) Get student count for logging
    const studentCount = group.students ? group.students.length : 0;

    // 2) Delete all students in this group from the system entirely
    await User.deleteMany({ _id: { $in: group.students } });

    // 3) Delete attendance records for this group
    await Attendance.deleteMany({ groupId: group._id });

    // 4) Remove the group
    await Group.deleteOne({ _id: group._id });

    console.log(`Group deleted successfully. Removed ${studentCount} students from the system.`);
    res.status(200).json({ 
      message: 'Group and all associated students deleted successfully', 
      studentsRemoved: studentCount 
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
};

// Fetch students for a group
const getGroupStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id).populate('students', 'Username Code phone parentPhone absences balance amountRemaining');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.status(200).json({ students: group.students });
  } catch (error) {
    console.error('Error fetching group students:', error);
    res.status(500).json({ message: 'Failed to fetch group students' });
  }
};

// Clear all students from a group without deleting the group or students
const clearRegisterGroupStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const removedCount = (group.students || []).length;
    group.students = [];
    await group.save();

    return res.status(200).json({ message: 'All students removed from group successfully', removedCount });
  } catch (error) {
    console.error('Error clearing group students:', error);
    res.status(500).json({ message: 'Failed to clear group students' });
  }
};

// Remove a single student from a register group (do NOT delete the group or the student)
const removeStudentFromRegisterGroup = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const wasMember = group.students?.some((s) => s.equals ? s.equals(studentId) : String(s) === String(studentId));
    if (!wasMember) {
      return res.status(400).json({ message: 'Student is not in this group' });
    }

    // Pull student from the group without deleting the student
    await Group.updateOne({ _id: id }, { $pull: { students: studentId } });

    // Optionally, keep student data intact. We are NOT clearing student's center/group fields to avoid schema validation issues.

    const updated = await Group.findById(id).populate('students', 'Username Code');
    res.status(200).json({ message: 'Student removed from group successfully', remainingCount: updated?.students?.length || 0 });
  } catch (error) {
    console.error('Error removing student from group:', error);
    res.status(500).json({ message: 'Failed to remove student from group' });
  }
};

// Seed RegisterGroup with legacy options (from old group.ejs)
const seedRegisterGroups = async (req, res) => {
  try {
    const seeds = [
      // GTA
      { centerName: 'GTA', Grade: 'EST', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Saturday & Tuesday @ 6PM' },
      { centerName: 'GTA', Grade: 'EST', gradeType: 'adv', groupTime: 'TEST', displayText: 'TEST' },
      { centerName: 'GTA', Grade: 'Basics', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Monday @ 6PM & Friday @ 5PM' },
      { centerName: 'GTA', Grade: 'SAT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Saturday @ 3:30PM & Tuesday @ 8PM' },

      // tagmo3
      { centerName: 'tagmo3', Grade: 'EST', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Sunday @ 6:30PM & Wednesday @ 4:30PM' },
      { centerName: 'tagmo3', Grade: 'Basics', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Sunday & Wednesday @ 8:30PM' },
      { centerName: 'tagmo3', Grade: 'SAT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Sunday @ 4:30PM & Wednesday @ 6:30PM' },

      // Online
      { centerName: 'Online', Grade: 'EST', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Online' },
      { centerName: 'Online', Grade: 'Basics', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Online' },
      { centerName: 'Online', Grade: 'SAT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Online' },
      { centerName: 'Online', Grade: 'SAT', gradeType: 'newAdv', groupTime: 'group1', displayText: 'Group(1) - Online' },
      { centerName: 'Online', Grade: 'ACT2', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Online' },
      { centerName: 'Online', Grade: 'ACT', gradeType: 'adv', groupTime: 'group1', displayText: 'Group(1) - Online' },
      { centerName: 'Online', Grade: 'ACT', gradeType: 'basic', groupTime: 'group2', displayText: 'Group(2) - Online' },
      { centerName: 'Online', Grade: 'EST2', gradeType: 'normal', groupTime: 'group1', displayText: 'Group(1) - Online' },
    ];

    let inserted = 0;
    for (const s of seeds) {
      try {
        await RegisterGroup.updateOne(
          { centerName: s.centerName, Grade: s.Grade, gradeType: s.gradeType, groupTime: s.groupTime },
          { $setOnInsert: s },
          { upsert: true }
        );
        inserted++;
      } catch (e) {
        // ignore duplicates
      }
    }
    res.status(200).json({ message: 'Seed completed', count: inserted });
  } catch (error) {
    console.error('Error seeding register groups:', error);
    res.status(500).json({ message: 'Failed to seed groups' });
  }
};

// =================================================== Log Out =================================================== //


const logOut = async (req, res) => {
  // Clearing the token cookie
  res.clearCookie('token');
  // Redirecting to the login page or any other desired page
  res.redirect('../login');
};

// =================================================== Connect WhatsApp =================================================== //


const connectWhatsapp_get = (req, res) => {
  res.render('teacher/connectWhatsapp', { title: 'Connect WhatsApp', path: req.path });
};

const createInstance = async (req, res) => {
  const { phoneNumber, name } = req.body;
  try {
    console.log(`Creating Wasender session (phone: ${phoneNumber || '-'}, name: ${name || '-'})`);
    
    // Create session with proper payload including required fields
    const sessionPayload = {
      name: name || 'WhatsApp Session',
      phone_number: phoneNumber || null,
      account_protection: true,  // Required field
      log_messages: true,        // Required field
      webhook_enabled: false,
      webhook_events: []
    };
    
    const resp = await wasender.createSession(sessionPayload);
    
    if (!resp.success) {
      return res.status(400).json(resp);
    }
    
    // Use the created session data from API response
    const created = resp.data;
    
    // If API doesn't return session data, create a fallback
    if (!created || !created.id) {
      const fallbackInstance = {
        id: `WA${Date.now()}`,
        name: name || 'WhatsApp Session',
        phone_number: phoneNumber || '-',
        status: 'disconnected',
        account_protection: true,
        log_messages: true,
        webhook_url: null,
        webhook_enabled: false,
        webhook_events: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.status(201).json({ success: true, data: fallbackInstance });
    }
    
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating Wasender session:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create session', error: error.message });
  }
};

const getInstances = async (req, res) => {
  try {
    const resp = await wasender.getAllSessions();
    if (!resp.success) {
      return res.status(401).json(resp);
    }
    return res.json(resp);
  } catch (error) {
    console.error('Error fetching sessions from Wasender:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch sessions', error: error.message });
  }
};

const testWasenderAuth = async (req, res) => {
  try {
    const resp = await wasender.testAuth();
    return res.json(resp);
  } catch (error) {
    console.error('Error testing Wasender auth:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to test authentication', error: error.message });
  }
};

const checkRealInstanceStatus = async (req, res) => {
  const { instanceId } = req.params;
  try {
    console.log(`Checking status for session: ${instanceId}`);
    
    // Get session details
    const detailsResult = await wasender.getSessionDetails(instanceId);
    if (!detailsResult.success) {
      console.error('Failed to get session details:', detailsResult.message);
      return res.status(500).json({ 
        success: false, 
        message: `Failed to get session details: ${detailsResult.message}` 
      });
    }
    
    const session = detailsResult.data;
    const waStatus = (session.status || 'unknown').toString().toUpperCase();
    
    console.log(`Session status: ${waStatus}`);

    // Map to UI statuses
    const mapStatus = (s) => {
      switch (s) {
        case 'CONNECTED':
        case 'AUTHENTICATED':
        case 'READY':
          return 'connected';
        case 'CONNECTING':
        case 'INITIALIZING':
          return 'connecting';
        case 'NEED_SCAN':
        case 'REQUIRE_QR':
        case 'UNPAIRED':
        case 'UNPAIRED_IDLE':
          return 'qr';
        case 'LOGGED_OUT':
        case 'DISCONNECTED':
          return 'disconnected';
        default:
          return 'disconnected';
      }
    };

    const status = mapStatus(waStatus);
    
    console.log(`Mapped status: ${status}`);

    return res.json({ 
      success: true, 
      apiStatus: waStatus, 
      status,
      session: {
        id: session.id,
        name: session.name,
        phone_number: session.phone_number,
        status: session.status,
        last_active_at: session.last_active_at
      }
    });
  } catch (error) {
    console.error('Error checking session status:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error checking session status', 
      error: error.message 
    });
  }
};

const generateQrCode = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    console.log(`Generating QR code for session: ${instanceId}`);
    
    // Step 1: Connect the session first
    const connectResult = await wasender.connectSession(instanceId);
    if (!connectResult.success) {
      console.error('Failed to connect session:', connectResult.message);
      return res.status(500).json({ 
        success: false, 
        message: `Failed to connect session: ${connectResult.message}` 
      });
    }
    
    console.log('Session connected successfully, getting QR code...');
    
    // Step 2: Get the QR code
    const qrResult = await wasender.getQRCode(instanceId);
    if (!qrResult.success) {
      console.error('Failed to get QR code:', qrResult.message);
      return res.status(500).json({ 
        success: false, 
        message: `Failed to get QR code: ${qrResult.message}` 
      });
    }
    
    let qrCodeData = qrResult.data?.qrcode || null;
    if (!qrCodeData) {
      console.error('No QR code data received');
      return res.status(500).json({ 
        success: false, 
        message: 'No QR code data received from API' 
      });
    }
    
    console.log('Raw QR code data received, converting to image...');
    
    // Convert the raw QR code data to a proper image
    // The Wasender API returns raw QR code data that needs to be converted
    try {
      // Generate QR code as data URL
      const qrImageDataUrl = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });
      
      console.log('QR code converted to image successfully');
      
      // Emit socket event for real-time updates
      if (req.io) {
        req.io.emit('instance-status-change', { 
          instanceId, 
          status: 'qr', 
          qrCode: qrImageDataUrl 
        });
      }
      
      return res.json({ 
        success: true, 
        qrCode: qrImageDataUrl, 
        status: 'qr',
        expiresIn: 45 // QR codes expire in 45 seconds
      });
      
    } catch (qrError) {
      console.error('Error converting QR code to image:', qrError);
      
      // Fallback: return the raw data with instructions
      return res.json({ 
        success: true, 
        qrCode: qrCodeData, 
        status: 'qr',
        note: 'Raw QR data - needs manual conversion',
        instructions: 'Please scan this QR code data manually or use a QR code generator',
        expiresIn: 45
      });
    }
    
  } catch (error) {
    console.error('Error generating QR code:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while generating QR code',
      error: error.message 
    });
  }
};


const deleteInstance = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    try { await wasender.disconnectSession(instanceId); } catch (_) {}
    try { await wasender.deleteSession(instanceId); } catch (_) {}
    if (req.io) req.io.emit('instance-deleted', { instanceId });
    return res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete session', error: error.message });
  }
};

// Note: Wasender API doesn't have a direct webhook setting endpoint
// This function is kept for compatibility but will need to be updated
// when webhook functionality is available in Wasender API
const setWebhook = async (req, res) => {
  const { instanceId } = req.params;
  const { webhookUrl } = req.body;
  
  if (!webhookUrl) {
    return res.status(400).json({
      success: false,
      message: 'Webhook URL is required'
    });
  }
  
  try {
    // Wasender API does not expose webhook setup in the provided collection.
    // Acknowledge and return success so UI can proceed.
    return res.status(200).json({
      success: true,
      message: 'Webhook setup is not supported by the current Wasender API. Value accepted locally.',
      webhookUrl
    });
  } catch (error) {
    console.error('Error setting webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting webhook',
      error: error.message
    });
  }
};

const rebootInstance = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    try { await wasender.disconnectSession(instanceId); } catch (_) {}
    await wasender.connectSession(instanceId);
    if (req.io) req.io.emit('instance-status-change', { instanceId, status: 'connecting' });
    return res.json({ success: true, message: 'Reconnecting initiated' });
  } catch (error) {
    console.error('Error reconnecting session:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to reconnect', error: error.message });
  }
};

// =================================================== Send Registration Message =================================================== //

const sendRegistrationMessage = async (req, res) => {
  try {
    // Get all students created before August 2nd, 2025
    // Note: Changed the date from February 8th to August 2nd, 2025
    const cutoffDate = new Date('2025-08-02');
    console.log(cutoffDate);
    const students = await User.find({
      createdAt: { $lt: cutoffDate },
      parentPhone: { $exists: true, $ne: null, $ne: '' }
    }).select('Username parentPhone parentPhoneCountryCode centerName phone phoneCountryCode');

    console.log(`Found ${students.length} students before cutoff date`);

    if (!students || students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found created before February 8th, 2025'
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const student of students) {
      try {
        let senderPhone;
        let message;
        
        // Determine sender phone and message based on center name
        if (student.centerName === "Online") {
          senderPhone = "01147929010"; // Online center phone
          message = `السلام عليكم 
برجاء العلم ان تم فتح تسجيل الكورسات من يوم 8/2 الى يوم 8/15 
و لن يقبل اي حجز بعد هذا الموعد  
برجاء التواصل معنا للحجز`;
        } else if (student.centerName === "GTA") {
          senderPhone = "01065057897"; // GTA center phone
          message = `السلام عليكم 
برجاء العلم ان تم فتح التسجيل في السنتر من يوم 8/2 الى يوم 8/15 
و لن يقبل اي حجز بعد هذا الموعد 
بمبلغ 700 جنيه شامل اول حصة + الكتاب 
برجاء التوجه لأقرب سنتر سواء التجمع و المعادي لحجز الاماكن`;
        } else if (student.centerName === "tagmo3") { // Default to Tagamo3
          senderPhone = "01055640148"; // Tagamo3 center phone
          message = `السلام عليكم 
برجاء العلم ان تم فتح التسجيل في السنتر من يوم 8/2 الى يوم 8/15 
و لن يقبل اي حجز بعد هذا الموعد 
بمبلغ 700 جنيه شامل اول حصة + الكتاب 
برجاء التوجه لأقرب سنتر سواء التجمع و المعادي لحجز الاماكن`;
        } 
        // Send message to parent
        try {
          const sendResult = await sendWappiMessage(
            message, 
            student.parentPhone, 
            senderPhone, 
            false, 
            student.parentPhoneCountryCode
          );
          if (!sendResult.success) {
            console.warn(`Warning: Failed to send WhatsApp message to parent: ${sendResult.message}`);
          }
        } catch (msgErr) {
          console.warn(`Warning: Error sending WhatsApp message to parent: ${msgErr.message}`);
        }
        
                // Send message to student if phone exists
        if (student.phone) {
          try {
            const sendResult = await sendWappiMessage(
              message, 
              student.phone,
              senderPhone, 
              false, 
              student.phoneCountryCode
            );
            if (!sendResult.success) {
              console.warn(`Warning: Failed to send WhatsApp message to student: ${sendResult.message}`);
            }
          } catch (msgErr) {
            console.warn(`Warning: Error sending WhatsApp message to student: ${msgErr.message}`);
          }
        }
        
        successCount++;
        console.log(`Message sent successfully to parent of ${student.Username} (${student.parentPhone}) from ${senderPhone}`);
        
      } catch (error) {
        errorCount++;
        errors.push({
          studentName: student.Username,
          phone: student.parentPhone,
          error: error.message
        });
        console.error(`Error sending message to parent of ${student.Username} (${student.parentPhone}):`, error);
      }

      // Add delay between messages to avoid rate limiting
      const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
      console.log(`Waiting for ${randomDelay}ms before next message`);
      await delay(randomDelay);
    }

    res.status(200).json({
      success: true,
      message: `Registration message sent to ${successCount} out of ${students.length} students`,
      totalStudents: students.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error sending registration messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending registration messages',
      error: error.message
    });
  }
};

// =================================================== END Send Registration Message =================================================== //

const regenerateQrCode = async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    console.log(`Regenerating QR code for session: ${instanceId}`);
    
    // Use the new regenerate method
    const qrResult = await wasender.regenerateQRCode(instanceId);
    if (!qrResult.success) {
      console.error('Failed to regenerate QR code:', qrResult.message);
      return res.status(500).json({ 
        success: false, 
        message: `Failed to regenerate QR code: ${qrResult.message}` 
      });
    }
    
    let qrCodeData = qrResult.data?.qrcode || null;
    if (!qrCodeData) {
      console.error('No QR code data received after regeneration');
      return res.status(500).json({ 
        success: false, 
        message: 'No QR code data received after regeneration' 
      });
    }
    
    console.log('New QR code data received, converting to image...');
    
    // Convert the raw QR code data to a proper image
    try {
      const qrImageDataUrl = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });
      
      console.log('New QR code converted to image successfully');
      
      // Emit socket event for real-time updates
      if (req.io) {
        req.io.emit('instance-status-change', { 
          instanceId, 
          status: 'qr', 
          qrCode: qrImageDataUrl 
        });
      }
      
      return res.json({ 
        success: true, 
        qrCode: qrImageDataUrl, 
        status: 'qr',
        expiresIn: 45,
        regenerated: true
      });
      
    } catch (qrError) {
      console.error('Error converting regenerated QR code to image:', qrError);
      
      return res.json({ 
        success: true, 
        qrCode: qrCodeData, 
        status: 'qr',
        note: 'Raw QR data - needs manual conversion',
        instructions: 'Please scan this QR code data manually or use a QR code generator',
        expiresIn: 45,
        regenerated: true
      });
    }
    
  } catch (error) {
    console.error('Error regenerating QR code:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while regenerating QR code',
      error: error.message 
    });
  }
};


module.exports = {
  dash_get,

  myStudent_get,

  studentsRequests_get,
  // confirmDeleteStudent,
  DeleteStudent,
  searchForUser,
  converStudentRequestsToExcel,
  getSingleUserAllData,
  updateUserData,
  blockStudent,
  unblockStudent,
  getStudentBlockHistory,

  searchToGetOneUserAllData,
  convertToExcelAllUserData,

  addCardGet,
  markAttendance,
  finalizeAttendance,

  addCardToStudent,
  getAttendedUsers,
  removeAttendance,
  updateAmount,

  
  handelAttendanceGet,
  getDates,
  getAttendees,
  convertAttendeesToExcel,


  // My Student Data
  getStudentData,
  convertAttendaceToExcel,
  advancedStudentSearch,
  

  // WhatsApp
  whatsApp_get,
  sendGradeMessages,
  sendMessages,
  sendGeneralMessages,

  // Connect WhatsApp
  connectWhatsapp_get,
  createInstance,
  getInstances,
  testWasenderAuth,
  generateQrCode,
  deleteInstance,
  checkRealInstanceStatus,

  // WhatsApp 2
  whatsApp2_get,
  getDataStudentInWhatsApp,
  submitData,

  // Convert Group
  convertGroup_get,
  getDataToTransferring,
  transferStudent,

  // Edit Groups
  editGroups_get,
  getGroupOptions,
  listRegisterGroups,
  createRegisterGroup,
  updateRegisterGroup,
  deleteRegisterGroup,
  getGroupStudents,
  removeStudentFromRegisterGroup,
  clearRegisterGroupStudents,
  listStudentsWithoutGroup,

  logOut,
  setWebhook,
  rebootInstance,
  
  // Registration Message
  sendRegistrationMessage,
  regenerateQrCode,
};
