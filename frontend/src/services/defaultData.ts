// University Academic Store Types and Authentic Fallback State
// Populated from verified student sync with live VTOP schema

export const DEFAULT_STUDENT_PROFILE = {
  "name": "DEMO STUDENT",
  "regNo": "21BCE0001",
  "email": "student@vitstudent.ac.in",
  "program": "B.Tech",
  "branch": "Computer Science and Engineering",
  "school": "SCOPE",
  "semester": "Fall Semester 2026-27",
  "semesterId": "CH20262701",
  "batch": "2021-2025",
  "cgpa": null,
  "creditsEarned": null,
  "totalCreditsRequired": null,
  "registeredCredits": 20.0,
  "rank": null,
  "overallAttendance": {
    "attended": 0,
    "total": 0,
    "rawPercentage": 0,
    "percentage": 0,
    "displayPercentage": "0%",
    "safeToMiss": 0,
    "needToAttend": 0,
    "isCritical": false,
    "status": "Safe",
    "hasValidData": false
  },
  "semesterGpa": [],
  "proctor": {
    "name": "FACULTY PROCTOR",
    "email": "proctor@vit.ac.in",
    "phone": "0000000000",
    "cabin": "AB-1 101",
    "designation": "Associate Professor",
    "school": "SCOPE",
    "rawFields": {
      "faculty id": "10001",
      "faculty name": "FACULTY PROCTOR",
      "faculty designation": "Associate Professor",
      "school": "SCOPE",
      "cabin": "AB-1 101",
      "faculty department": "Computer Science",
      "faculty email": "proctor@vit.ac.in",
      "faculty mobile number": "0000000000"
    }
  },
  "gender": null,
  "isHosteller": false,
  "blockName": null,
  "roomNo": null,
  "messInfo": null,
  "lastSynced": null
};

export const DEFAULT_COURSES: any[] = [
  {
    "id": "1",
    "code": "BCSE302L",
    "title": "Database Systems",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "F2+TF2",
    "slots": [
      "F2",
      "TF2"
    ],
    "venue": "AB1-811",
    "faculty": "RISHIKESHAN C A",
    "credits": 3.0,
    "grade": null,
    "attendance": {
      "id": "1",
      "courseId": 1,
      "courseCode": "BCSE302L",
      "courseTitle": "Database Systems",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "F2",
      "slots": "F2+TF2",
      "venue": "AB1-811",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 34.0,
        "max": 50.0,
        "weightage": 10.2,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "2",
    "code": "BCSE302P",
    "title": "Database Systems Lab",
    "type": "Lab",
    "typeKey": "lab",
    "slot": "L21+L22",
    "slots": [
      "L21",
      "L22"
    ],
    "venue": "AB4-411",
    "faculty": "RISHIKESHAN C A",
    "credits": 1.0,
    "grade": null,
    "attendance": {
      "id": "2",
      "courseId": 2,
      "courseCode": "BCSE302P",
      "courseTitle": "Database Systems Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L21",
      "slots": "L21+L22",
      "venue": "AB4-411",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": null
  },
  {
    "id": "3",
    "code": "BCSE308L",
    "title": "Computer Networks",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "A2+TA2",
    "slots": [
      "A2",
      "TA2"
    ],
    "venue": "AB1-808",
    "faculty": "JAYA VIGNESH T",
    "credits": 3.0,
    "grade": null,
    "attendance": {
      "id": "3",
      "courseId": 3,
      "courseCode": "BCSE308L",
      "courseTitle": "Computer Networks",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "A2",
      "slots": "A2+TA2",
      "venue": "AB1-808",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 32.5,
        "max": 50.0,
        "weightage": 9.75,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "4",
    "code": "BCSE308P",
    "title": "Computer Networks Lab",
    "type": "Lab",
    "typeKey": "lab",
    "slot": "L9+L10",
    "slots": [
      "L9",
      "L10"
    ],
    "venue": "AB4-407",
    "faculty": "JAYA VIGNESH T",
    "credits": 1.0,
    "grade": null,
    "attendance": {
      "id": "4",
      "courseId": 4,
      "courseCode": "BCSE308P",
      "courseTitle": "Computer Networks Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L9",
      "slots": "L9+L10",
      "venue": "AB4-407",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": null
  },
  {
    "id": "5",
    "code": "BECE303L",
    "title": "VLSI System Design",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "B2+TB2",
    "slots": [
      "B2",
      "TB2"
    ],
    "venue": "AB1-811",
    "faculty": "SARAVANA KUMAR R",
    "credits": 3.0,
    "grade": null,
    "attendance": {
      "id": "5",
      "courseId": 5,
      "courseCode": "BECE303L",
      "courseTitle": "VLSI System Design",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "B2",
      "slots": "B2+TB2",
      "venue": "AB1-811",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 22.0,
        "max": 50.0,
        "weightage": 6.6,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "6",
    "code": "BECE303P",
    "title": "VLSI System Design Lab",
    "type": "Lab",
    "typeKey": "lab",
    "slot": "L15+L16",
    "slots": [
      "L15",
      "L16"
    ],
    "venue": "AB3-312",
    "faculty": "SARAVANA KUMAR R",
    "credits": 1.0,
    "grade": null,
    "attendance": {
      "id": "6",
      "courseId": 6,
      "courseCode": "BECE303P",
      "courseTitle": "VLSI System Design Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L15",
      "slots": "L15+L16",
      "venue": "AB3-312",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": null
  },
  {
    "id": "7",
    "code": "BECE309L",
    "title": "Artificial Intelligence and Machine Learning",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "G2+TG2",
    "slots": [
      "G2",
      "TG2"
    ],
    "venue": "AB1-802",
    "faculty": "PRAVEEN JARAUT",
    "credits": 3.0,
    "grade": null,
    "attendance": {
      "id": "7",
      "courseId": 7,
      "courseCode": "BECE309L",
      "courseTitle": "Artificial Intelligence and Machine Learning",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "G2",
      "slots": "G2+TG2",
      "venue": "AB1-802",
      "faculty": "PRAVEEN JARAUT",
      "facultyName": "PRAVEEN JARAUT",
      "courseName": "Artificial Intelligence and Machine Learning",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 30,
      "classesConducted": 31,
      "attendancePercentage": 96.8,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 30,
      "total": 31,
      "rawPercentage": 96.7741935483871,
      "percentage": 96.8,
      "displayPercentage": "96.8%",
      "safeToMiss": 9,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 38.0,
        "max": 50.0,
        "weightage": 11.4,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "8",
    "code": "BECE355L",
    "title": "Advanced Cloud Computing",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "C2+TC2",
    "slots": [
      "C2",
      "TC2"
    ],
    "venue": "AB1-711",
    "faculty": "UPENDER P",
    "credits": 3.0,
    "grade": null,
    "attendance": {
      "id": "8",
      "courseId": 8,
      "courseCode": "BECE355L",
      "courseTitle": "Advanced Cloud Computing",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "C2",
      "slots": "C2+TC2",
      "venue": "AB1-711",
      "faculty": "UPENDER P",
      "facultyName": "UPENDER P",
      "courseName": "Advanced Cloud Computing",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 28,
      "classesConducted": 30,
      "attendancePercentage": 93.3,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 28,
      "total": 30,
      "rawPercentage": 93.33333333333333,
      "percentage": 93.3,
      "displayPercentage": "93.3%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 46.0,
        "max": 50.0,
        "weightage": 13.8,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "9",
    "code": "BMAT202L",
    "title": "Probability and Statistics",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "E2+TE2",
    "slots": [
      "E2",
      "TE2"
    ],
    "venue": "AB1-802",
    "faculty": "THANGARAJ M",
    "credits": 3.0,
    "grade": null,
    "attendance": {
      "id": "9",
      "courseId": 9,
      "courseCode": "BMAT202L",
      "courseTitle": "Probability and Statistics",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "E2",
      "slots": "E2+TE2",
      "venue": "AB1-802",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 30,
      "attendancePercentage": 90.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 90.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 30,
      "rawPercentage": 90.0,
      "percentage": 90.0,
      "displayPercentage": "90.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 28.0,
        "max": 50.0,
        "weightage": 8.4,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "10",
    "code": "BMAT202P",
    "title": "Probability and Statistics Lab",
    "type": "Lab",
    "typeKey": "lab",
    "slot": "L19+L20",
    "slots": [
      "L19",
      "L20"
    ],
    "venue": "AB1-606A",
    "faculty": "THANGARAJ M",
    "credits": 1.0,
    "grade": null,
    "attendance": {
      "id": "10",
      "courseId": 10,
      "courseCode": "BMAT202P",
      "courseTitle": "Probability and Statistics Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L19",
      "slots": "L19+L20",
      "venue": "AB1-606A",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": null
  },
  {
    "id": "11",
    "code": "BSSC101N",
    "title": "Essence of Traditional Knowledge",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "NIL",
    "slots": [
      "NIL"
    ],
    "venue": "NIL",
    "faculty": "MAHARISHI R",
    "credits": 2.0,
    "grade": null,
    "attendance": null,
    "odHours": 0,
    "marks": [
      {
        "title": "Assessment - 3",
        "scored": 9.0,
        "max": 10.0,
        "weightage": 9.0,
        "maxWeightage": 10.0,
        "average": null,
        "status": "Present"
      },
      {
        "title": "Assessment - 2",
        "scored": 9.0,
        "max": 10.0,
        "weightage": 9.0,
        "maxWeightage": 10.0,
        "average": null,
        "status": "Present"
      },
      {
        "title": "Assessment - 1",
        "scored": 8.0,
        "max": 10.0,
        "weightage": 8.0,
        "maxWeightage": 10.0,
        "average": null,
        "status": "Present"
      }
    ]
  },
  {
    "id": "12",
    "code": "BSTS301P",
    "title": "Advanced Competitive Coding - I",
    "type": "Theory",
    "typeKey": "theory",
    "slot": "D2+TD2",
    "slots": [
      "D2",
      "TD2"
    ],
    "venue": "AB1-710",
    "faculty": "ETHNUS (APT)",
    "credits": 1.5,
    "grade": null,
    "attendance": {
      "id": "12",
      "courseId": 12,
      "courseCode": "BSTS301P",
      "courseTitle": "Advanced Competitive Coding - I",
      "courseType": "Soft Skill",
      "type": "Theory",
      "slot": "D2",
      "slots": "D2+TD2",
      "venue": "AB1-710",
      "faculty": "ETHNUS (APT)",
      "facultyName": "ETHNUS (APT)",
      "courseName": "Advanced Competitive Coding - I",
      "credits": 1.5,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0,
    "marks": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 27.0,
        "max": 30.0,
        "weightage": 13.5,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      },
      {
        "title": "Assessment - 1",
        "scored": 12.0,
        "max": 15.0,
        "weightage": 12.0,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ]
  }
];

export const DEFAULT_TIMETABLE: any[] = [
  {
    "id": "MON-14:00-A2",
    "day": "MON",
    "dayName": "Monday",
    "slotName": "A2",
    "slot": "A2",
    "startTime": "14:00",
    "endTime": "14:50",
    "startTime12h": "02:00 PM",
    "endTime12h": "02:50 PM",
    "courseId": 3,
    "courseCode": "BCSE308L",
    "courseName": "Computer Networks",
    "courseTitle": "Computer Networks",
    "subjectCode": "BCSE308L",
    "subjectTitle": "Computer Networks",
    "venue": "AB1-808",
    "room": "808",
    "building": "AB1",
    "block": "AB1",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "3",
      "courseId": 3,
      "courseCode": "BCSE308L",
      "courseTitle": "Computer Networks",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "A2",
      "slots": "A2+TA2",
      "venue": "AB1-808",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "MON-14:55-F2",
    "day": "MON",
    "dayName": "Monday",
    "slotName": "F2",
    "slot": "F2",
    "startTime": "14:55",
    "endTime": "15:45",
    "startTime12h": "02:55 PM",
    "endTime12h": "03:45 PM",
    "courseId": 1,
    "courseCode": "BCSE302L",
    "courseName": "Database Systems",
    "courseTitle": "Database Systems",
    "subjectCode": "BCSE302L",
    "subjectTitle": "Database Systems",
    "venue": "AB1-811",
    "room": "811",
    "building": "AB1",
    "block": "AB1",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "1",
      "courseId": 1,
      "courseCode": "BCSE302L",
      "courseTitle": "Database Systems",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "F2",
      "slots": "F2+TF2",
      "venue": "AB1-811",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "MON-15:50-D2",
    "day": "MON",
    "dayName": "Monday",
    "slotName": "D2",
    "slot": "D2",
    "startTime": "15:50",
    "endTime": "16:40",
    "startTime12h": "03:50 PM",
    "endTime12h": "04:40 PM",
    "courseId": 12,
    "courseCode": "BSTS301P",
    "courseName": "Advanced Competitive Coding - I",
    "courseTitle": "Advanced Competitive Coding - I",
    "subjectCode": "BSTS301P",
    "subjectTitle": "Advanced Competitive Coding - I",
    "venue": "AB1-710",
    "room": "710",
    "building": "AB1",
    "block": "AB1",
    "faculty": "ETHNUS (APT)",
    "facultyName": "ETHNUS (APT)",
    "credits": 1.5,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "12",
      "courseId": 12,
      "courseCode": "BSTS301P",
      "courseTitle": "Advanced Competitive Coding - I",
      "courseType": "Soft Skill",
      "type": "Theory",
      "slot": "D2",
      "slots": "D2+TD2",
      "venue": "AB1-710",
      "faculty": "ETHNUS (APT)",
      "facultyName": "ETHNUS (APT)",
      "courseName": "Advanced Competitive Coding - I",
      "credits": 1.5,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "MON-16:45-TB2",
    "day": "MON",
    "dayName": "Monday",
    "slotName": "TB2",
    "slot": "TB2",
    "startTime": "16:45",
    "endTime": "17:35",
    "startTime12h": "04:45 PM",
    "endTime12h": "05:35 PM",
    "courseId": 5,
    "courseCode": "BECE303L",
    "courseName": "VLSI System Design",
    "courseTitle": "VLSI System Design",
    "subjectCode": "BECE303L",
    "subjectTitle": "VLSI System Design",
    "venue": "AB1-811",
    "room": "811",
    "building": "AB1",
    "block": "AB1",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "5",
      "courseId": 5,
      "courseCode": "BECE303L",
      "courseTitle": "VLSI System Design",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "B2",
      "slots": "B2+TB2",
      "venue": "AB1-811",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "MON-17:40-TG2",
    "day": "MON",
    "dayName": "Monday",
    "slotName": "TG2",
    "slot": "TG2",
    "startTime": "17:40",
    "endTime": "18:30",
    "startTime12h": "05:40 PM",
    "endTime12h": "06:30 PM",
    "courseId": 7,
    "courseCode": "BECE309L",
    "courseName": "Artificial Intelligence and Machine Learning",
    "courseTitle": "Artificial Intelligence and Machine Learning",
    "subjectCode": "BECE309L",
    "subjectTitle": "Artificial Intelligence and Machine Learning",
    "venue": "AB1-802",
    "room": "802",
    "building": "AB1",
    "block": "AB1",
    "faculty": "PRAVEEN JARAUT",
    "facultyName": "PRAVEEN JARAUT",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "7",
      "courseId": 7,
      "courseCode": "BECE309L",
      "courseTitle": "Artificial Intelligence and Machine Learning",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "G2",
      "slots": "G2+TG2",
      "venue": "AB1-802",
      "faculty": "PRAVEEN JARAUT",
      "facultyName": "PRAVEEN JARAUT",
      "courseName": "Artificial Intelligence and Machine Learning",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 30,
      "classesConducted": 31,
      "attendancePercentage": 96.8,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 30,
      "total": 31,
      "rawPercentage": 96.7741935483871,
      "percentage": 96.8,
      "displayPercentage": "96.8%",
      "safeToMiss": 9,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "TUE-09:50-L9",
    "day": "TUE",
    "dayName": "Tuesday",
    "slotName": "L9",
    "slot": "L9",
    "startTime": "09:50",
    "endTime": "10:40",
    "startTime12h": "09:50 AM",
    "endTime12h": "10:40 AM",
    "courseId": 4,
    "courseCode": "BCSE308P",
    "courseName": "Computer Networks Lab",
    "courseTitle": "Computer Networks Lab",
    "subjectCode": "BCSE308P",
    "subjectTitle": "Computer Networks Lab",
    "venue": "AB4-407",
    "room": "407",
    "building": "AB4",
    "block": "AB4",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "4",
      "courseId": 4,
      "courseCode": "BCSE308P",
      "courseTitle": "Computer Networks Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L9",
      "slots": "L9+L10",
      "venue": "AB4-407",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "TUE-10:40-L10",
    "day": "TUE",
    "dayName": "Tuesday",
    "slotName": "L10",
    "slot": "L10",
    "startTime": "10:40",
    "endTime": "11:30",
    "startTime12h": "10:40 AM",
    "endTime12h": "11:30 AM",
    "courseId": 4,
    "courseCode": "BCSE308P",
    "courseName": "Computer Networks Lab",
    "courseTitle": "Computer Networks Lab",
    "subjectCode": "BCSE308P",
    "subjectTitle": "Computer Networks Lab",
    "venue": "AB4-407",
    "room": "407",
    "building": "AB4",
    "block": "AB4",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "4",
      "courseId": 4,
      "courseCode": "BCSE308P",
      "courseTitle": "Computer Networks Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L9",
      "slots": "L9+L10",
      "venue": "AB4-407",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "TUE-14:00-B2",
    "day": "TUE",
    "dayName": "Tuesday",
    "slotName": "B2",
    "slot": "B2",
    "startTime": "14:00",
    "endTime": "14:50",
    "startTime12h": "02:00 PM",
    "endTime12h": "02:50 PM",
    "courseId": 5,
    "courseCode": "BECE303L",
    "courseName": "VLSI System Design",
    "courseTitle": "VLSI System Design",
    "subjectCode": "BECE303L",
    "subjectTitle": "VLSI System Design",
    "venue": "AB1-811",
    "room": "811",
    "building": "AB1",
    "block": "AB1",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "5",
      "courseId": 5,
      "courseCode": "BECE303L",
      "courseTitle": "VLSI System Design",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "B2",
      "slots": "B2+TB2",
      "venue": "AB1-811",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "TUE-14:55-G2",
    "day": "TUE",
    "dayName": "Tuesday",
    "slotName": "G2",
    "slot": "G2",
    "startTime": "14:55",
    "endTime": "15:45",
    "startTime12h": "02:55 PM",
    "endTime12h": "03:45 PM",
    "courseId": 7,
    "courseCode": "BECE309L",
    "courseName": "Artificial Intelligence and Machine Learning",
    "courseTitle": "Artificial Intelligence and Machine Learning",
    "subjectCode": "BECE309L",
    "subjectTitle": "Artificial Intelligence and Machine Learning",
    "venue": "AB1-802",
    "room": "802",
    "building": "AB1",
    "block": "AB1",
    "faculty": "PRAVEEN JARAUT",
    "facultyName": "PRAVEEN JARAUT",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "7",
      "courseId": 7,
      "courseCode": "BECE309L",
      "courseTitle": "Artificial Intelligence and Machine Learning",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "G2",
      "slots": "G2+TG2",
      "venue": "AB1-802",
      "faculty": "PRAVEEN JARAUT",
      "facultyName": "PRAVEEN JARAUT",
      "courseName": "Artificial Intelligence and Machine Learning",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 30,
      "classesConducted": 31,
      "attendancePercentage": 96.8,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 30,
      "total": 31,
      "rawPercentage": 96.7741935483871,
      "percentage": 96.8,
      "displayPercentage": "96.8%",
      "safeToMiss": 9,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "TUE-15:50-E2",
    "day": "TUE",
    "dayName": "Tuesday",
    "slotName": "E2",
    "slot": "E2",
    "startTime": "15:50",
    "endTime": "16:40",
    "startTime12h": "03:50 PM",
    "endTime12h": "04:40 PM",
    "courseId": 9,
    "courseCode": "BMAT202L",
    "courseName": "Probability and Statistics",
    "courseTitle": "Probability and Statistics",
    "subjectCode": "BMAT202L",
    "subjectTitle": "Probability and Statistics",
    "venue": "AB1-802",
    "room": "802",
    "building": "AB1",
    "block": "AB1",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "9",
      "courseId": 9,
      "courseCode": "BMAT202L",
      "courseTitle": "Probability and Statistics",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "E2",
      "slots": "E2+TE2",
      "venue": "AB1-802",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 30,
      "attendancePercentage": 90.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 90.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 30,
      "rawPercentage": 90.0,
      "percentage": 90.0,
      "displayPercentage": "90.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "TUE-16:45-TC2",
    "day": "TUE",
    "dayName": "Tuesday",
    "slotName": "TC2",
    "slot": "TC2",
    "startTime": "16:45",
    "endTime": "17:35",
    "startTime12h": "04:45 PM",
    "endTime12h": "05:35 PM",
    "courseId": 8,
    "courseCode": "BECE355L",
    "courseName": "Advanced Cloud Computing",
    "courseTitle": "Advanced Cloud Computing",
    "subjectCode": "BECE355L",
    "subjectTitle": "Advanced Cloud Computing",
    "venue": "AB1-711",
    "room": "711",
    "building": "AB1",
    "block": "AB1",
    "faculty": "UPENDER P",
    "facultyName": "UPENDER P",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "8",
      "courseId": 8,
      "courseCode": "BECE355L",
      "courseTitle": "Advanced Cloud Computing",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "C2",
      "slots": "C2+TC2",
      "venue": "AB1-711",
      "faculty": "UPENDER P",
      "facultyName": "UPENDER P",
      "courseName": "Advanced Cloud Computing",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 28,
      "classesConducted": 30,
      "attendancePercentage": 93.3,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 28,
      "total": 30,
      "rawPercentage": 93.33333333333333,
      "percentage": 93.3,
      "displayPercentage": "93.3%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "WED-09:50-L15",
    "day": "WED",
    "dayName": "Wednesday",
    "slotName": "L15",
    "slot": "L15",
    "startTime": "09:50",
    "endTime": "10:40",
    "startTime12h": "09:50 AM",
    "endTime12h": "10:40 AM",
    "courseId": 6,
    "courseCode": "BECE303P",
    "courseName": "VLSI System Design Lab",
    "courseTitle": "VLSI System Design Lab",
    "subjectCode": "BECE303P",
    "subjectTitle": "VLSI System Design Lab",
    "venue": "AB3-312",
    "room": "312",
    "building": "AB3",
    "block": "AB3",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "6",
      "courseId": 6,
      "courseCode": "BECE303P",
      "courseTitle": "VLSI System Design Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L15",
      "slots": "L15+L16",
      "venue": "AB3-312",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "WED-10:40-L16",
    "day": "WED",
    "dayName": "Wednesday",
    "slotName": "L16",
    "slot": "L16",
    "startTime": "10:40",
    "endTime": "11:30",
    "startTime12h": "10:40 AM",
    "endTime12h": "11:30 AM",
    "courseId": 6,
    "courseCode": "BECE303P",
    "courseName": "VLSI System Design Lab",
    "courseTitle": "VLSI System Design Lab",
    "subjectCode": "BECE303P",
    "subjectTitle": "VLSI System Design Lab",
    "venue": "AB3-312",
    "room": "312",
    "building": "AB3",
    "block": "AB3",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "6",
      "courseId": 6,
      "courseCode": "BECE303P",
      "courseTitle": "VLSI System Design Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L15",
      "slots": "L15+L16",
      "venue": "AB3-312",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "WED-14:00-C2",
    "day": "WED",
    "dayName": "Wednesday",
    "slotName": "C2",
    "slot": "C2",
    "startTime": "14:00",
    "endTime": "14:50",
    "startTime12h": "02:00 PM",
    "endTime12h": "02:50 PM",
    "courseId": 8,
    "courseCode": "BECE355L",
    "courseName": "Advanced Cloud Computing",
    "courseTitle": "Advanced Cloud Computing",
    "subjectCode": "BECE355L",
    "subjectTitle": "Advanced Cloud Computing",
    "venue": "AB1-711",
    "room": "711",
    "building": "AB1",
    "block": "AB1",
    "faculty": "UPENDER P",
    "facultyName": "UPENDER P",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "8",
      "courseId": 8,
      "courseCode": "BECE355L",
      "courseTitle": "Advanced Cloud Computing",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "C2",
      "slots": "C2+TC2",
      "venue": "AB1-711",
      "faculty": "UPENDER P",
      "facultyName": "UPENDER P",
      "courseName": "Advanced Cloud Computing",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 28,
      "classesConducted": 30,
      "attendancePercentage": 93.3,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 28,
      "total": 30,
      "rawPercentage": 93.33333333333333,
      "percentage": 93.3,
      "displayPercentage": "93.3%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "WED-14:55-A2",
    "day": "WED",
    "dayName": "Wednesday",
    "slotName": "A2",
    "slot": "A2",
    "startTime": "14:55",
    "endTime": "15:45",
    "startTime12h": "02:55 PM",
    "endTime12h": "03:45 PM",
    "courseId": 3,
    "courseCode": "BCSE308L",
    "courseName": "Computer Networks",
    "courseTitle": "Computer Networks",
    "subjectCode": "BCSE308L",
    "subjectTitle": "Computer Networks",
    "venue": "AB1-808",
    "room": "808",
    "building": "AB1",
    "block": "AB1",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "3",
      "courseId": 3,
      "courseCode": "BCSE308L",
      "courseTitle": "Computer Networks",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "A2",
      "slots": "A2+TA2",
      "venue": "AB1-808",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "WED-15:50-F2",
    "day": "WED",
    "dayName": "Wednesday",
    "slotName": "F2",
    "slot": "F2",
    "startTime": "15:50",
    "endTime": "16:40",
    "startTime12h": "03:50 PM",
    "endTime12h": "04:40 PM",
    "courseId": 1,
    "courseCode": "BCSE302L",
    "courseName": "Database Systems",
    "courseTitle": "Database Systems",
    "subjectCode": "BCSE302L",
    "subjectTitle": "Database Systems",
    "venue": "AB1-811",
    "room": "811",
    "building": "AB1",
    "block": "AB1",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "1",
      "courseId": 1,
      "courseCode": "BCSE302L",
      "courseTitle": "Database Systems",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "F2",
      "slots": "F2+TF2",
      "venue": "AB1-811",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "WED-16:45-TD2",
    "day": "WED",
    "dayName": "Wednesday",
    "slotName": "TD2",
    "slot": "TD2",
    "startTime": "16:45",
    "endTime": "17:35",
    "startTime12h": "04:45 PM",
    "endTime12h": "05:35 PM",
    "courseId": 12,
    "courseCode": "BSTS301P",
    "courseName": "Advanced Competitive Coding - I",
    "courseTitle": "Advanced Competitive Coding - I",
    "subjectCode": "BSTS301P",
    "subjectTitle": "Advanced Competitive Coding - I",
    "venue": "AB1-710",
    "room": "710",
    "building": "AB1",
    "block": "AB1",
    "faculty": "ETHNUS (APT)",
    "facultyName": "ETHNUS (APT)",
    "credits": 1.5,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "12",
      "courseId": 12,
      "courseCode": "BSTS301P",
      "courseTitle": "Advanced Competitive Coding - I",
      "courseType": "Soft Skill",
      "type": "Theory",
      "slot": "D2",
      "slots": "D2+TD2",
      "venue": "AB1-710",
      "faculty": "ETHNUS (APT)",
      "facultyName": "ETHNUS (APT)",
      "courseName": "Advanced Competitive Coding - I",
      "credits": 1.5,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-08:00-L19",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "L19",
    "slot": "L19",
    "startTime": "08:00",
    "endTime": "08:50",
    "startTime12h": "08:00 AM",
    "endTime12h": "08:50 AM",
    "courseId": 10,
    "courseCode": "BMAT202P",
    "courseName": "Probability and Statistics Lab",
    "courseTitle": "Probability and Statistics Lab",
    "subjectCode": "BMAT202P",
    "subjectTitle": "Probability and Statistics Lab",
    "venue": "AB1-606A",
    "room": "606A",
    "building": "AB1",
    "block": "AB1",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "10",
      "courseId": 10,
      "courseCode": "BMAT202P",
      "courseTitle": "Probability and Statistics Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L19",
      "slots": "L19+L20",
      "venue": "AB1-606A",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-08:50-L20",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "L20",
    "slot": "L20",
    "startTime": "08:50",
    "endTime": "09:40",
    "startTime12h": "08:50 AM",
    "endTime12h": "09:40 AM",
    "courseId": 10,
    "courseCode": "BMAT202P",
    "courseName": "Probability and Statistics Lab",
    "courseTitle": "Probability and Statistics Lab",
    "subjectCode": "BMAT202P",
    "subjectTitle": "Probability and Statistics Lab",
    "venue": "AB1-606A",
    "room": "606A",
    "building": "AB1",
    "block": "AB1",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "10",
      "courseId": 10,
      "courseCode": "BMAT202P",
      "courseTitle": "Probability and Statistics Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L19",
      "slots": "L19+L20",
      "venue": "AB1-606A",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-09:50-L21",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "L21",
    "slot": "L21",
    "startTime": "09:50",
    "endTime": "10:40",
    "startTime12h": "09:50 AM",
    "endTime12h": "10:40 AM",
    "courseId": 2,
    "courseCode": "BCSE302P",
    "courseName": "Database Systems Lab",
    "courseTitle": "Database Systems Lab",
    "subjectCode": "BCSE302P",
    "subjectTitle": "Database Systems Lab",
    "venue": "AB4-411",
    "room": "411",
    "building": "AB4",
    "block": "AB4",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "2",
      "courseId": 2,
      "courseCode": "BCSE302P",
      "courseTitle": "Database Systems Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L21",
      "slots": "L21+L22",
      "venue": "AB4-411",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-10:40-L22",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "L22",
    "slot": "L22",
    "startTime": "10:40",
    "endTime": "11:30",
    "startTime12h": "10:40 AM",
    "endTime12h": "11:30 AM",
    "courseId": 2,
    "courseCode": "BCSE302P",
    "courseName": "Database Systems Lab",
    "courseTitle": "Database Systems Lab",
    "subjectCode": "BCSE302P",
    "subjectTitle": "Database Systems Lab",
    "venue": "AB4-411",
    "room": "411",
    "building": "AB4",
    "block": "AB4",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 1.0,
    "isLab": true,
    "classType": "Lab",
    "type": "Lab",
    "resolved": true,
    "attendance": {
      "id": "2",
      "courseId": 2,
      "courseCode": "BCSE302P",
      "courseTitle": "Database Systems Lab",
      "courseType": "Lab Only",
      "type": "Lab",
      "slot": "L21",
      "slots": "L21+L22",
      "venue": "AB4-411",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems Lab",
      "credits": 1.0,
      "resolved": true,
      "classesAttended": 20,
      "classesConducted": 20,
      "attendancePercentage": 100.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 100.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 20,
      "total": 20,
      "rawPercentage": 100.0,
      "percentage": 100.0,
      "displayPercentage": "100.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-14:00-D2",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "D2",
    "slot": "D2",
    "startTime": "14:00",
    "endTime": "14:50",
    "startTime12h": "02:00 PM",
    "endTime12h": "02:50 PM",
    "courseId": 12,
    "courseCode": "BSTS301P",
    "courseName": "Advanced Competitive Coding - I",
    "courseTitle": "Advanced Competitive Coding - I",
    "subjectCode": "BSTS301P",
    "subjectTitle": "Advanced Competitive Coding - I",
    "venue": "AB1-710",
    "room": "710",
    "building": "AB1",
    "block": "AB1",
    "faculty": "ETHNUS (APT)",
    "facultyName": "ETHNUS (APT)",
    "credits": 1.5,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "12",
      "courseId": 12,
      "courseCode": "BSTS301P",
      "courseTitle": "Advanced Competitive Coding - I",
      "courseType": "Soft Skill",
      "type": "Theory",
      "slot": "D2",
      "slots": "D2+TD2",
      "venue": "AB1-710",
      "faculty": "ETHNUS (APT)",
      "facultyName": "ETHNUS (APT)",
      "courseName": "Advanced Competitive Coding - I",
      "credits": 1.5,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-14:55-B2",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "B2",
    "slot": "B2",
    "startTime": "14:55",
    "endTime": "15:45",
    "startTime12h": "02:55 PM",
    "endTime12h": "03:45 PM",
    "courseId": 5,
    "courseCode": "BECE303L",
    "courseName": "VLSI System Design",
    "courseTitle": "VLSI System Design",
    "subjectCode": "BECE303L",
    "subjectTitle": "VLSI System Design",
    "venue": "AB1-811",
    "room": "811",
    "building": "AB1",
    "block": "AB1",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "5",
      "courseId": 5,
      "courseCode": "BECE303L",
      "courseTitle": "VLSI System Design",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "B2",
      "slots": "B2+TB2",
      "venue": "AB1-811",
      "faculty": "SARAVANA KUMAR R",
      "facultyName": "SARAVANA KUMAR R",
      "courseName": "VLSI System Design",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 29,
      "attendancePercentage": 93.1,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 29,
      "rawPercentage": 93.10344827586206,
      "percentage": 93.1,
      "displayPercentage": "93.1%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-15:50-G2",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "G2",
    "slot": "G2",
    "startTime": "15:50",
    "endTime": "16:40",
    "startTime12h": "03:50 PM",
    "endTime12h": "04:40 PM",
    "courseId": 7,
    "courseCode": "BECE309L",
    "courseName": "Artificial Intelligence and Machine Learning",
    "courseTitle": "Artificial Intelligence and Machine Learning",
    "subjectCode": "BECE309L",
    "subjectTitle": "Artificial Intelligence and Machine Learning",
    "venue": "AB1-802",
    "room": "802",
    "building": "AB1",
    "block": "AB1",
    "faculty": "PRAVEEN JARAUT",
    "facultyName": "PRAVEEN JARAUT",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "7",
      "courseId": 7,
      "courseCode": "BECE309L",
      "courseTitle": "Artificial Intelligence and Machine Learning",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "G2",
      "slots": "G2+TG2",
      "venue": "AB1-802",
      "faculty": "PRAVEEN JARAUT",
      "facultyName": "PRAVEEN JARAUT",
      "courseName": "Artificial Intelligence and Machine Learning",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 30,
      "classesConducted": 31,
      "attendancePercentage": 96.8,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 30,
      "total": 31,
      "rawPercentage": 96.7741935483871,
      "percentage": 96.8,
      "displayPercentage": "96.8%",
      "safeToMiss": 9,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "THU-16:45-TE2",
    "day": "THU",
    "dayName": "Thursday",
    "slotName": "TE2",
    "slot": "TE2",
    "startTime": "16:45",
    "endTime": "17:35",
    "startTime12h": "04:45 PM",
    "endTime12h": "05:35 PM",
    "courseId": 9,
    "courseCode": "BMAT202L",
    "courseName": "Probability and Statistics",
    "courseTitle": "Probability and Statistics",
    "subjectCode": "BMAT202L",
    "subjectTitle": "Probability and Statistics",
    "venue": "AB1-802",
    "room": "802",
    "building": "AB1",
    "block": "AB1",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "9",
      "courseId": 9,
      "courseCode": "BMAT202L",
      "courseTitle": "Probability and Statistics",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "E2",
      "slots": "E2+TE2",
      "venue": "AB1-802",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 30,
      "attendancePercentage": 90.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 90.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 30,
      "rawPercentage": 90.0,
      "percentage": 90.0,
      "displayPercentage": "90.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "FRI-14:00-E2",
    "day": "FRI",
    "dayName": "Friday",
    "slotName": "E2",
    "slot": "E2",
    "startTime": "14:00",
    "endTime": "14:50",
    "startTime12h": "02:00 PM",
    "endTime12h": "02:50 PM",
    "courseId": 9,
    "courseCode": "BMAT202L",
    "courseName": "Probability and Statistics",
    "courseTitle": "Probability and Statistics",
    "subjectCode": "BMAT202L",
    "subjectTitle": "Probability and Statistics",
    "venue": "AB1-802",
    "room": "802",
    "building": "AB1",
    "block": "AB1",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "9",
      "courseId": 9,
      "courseCode": "BMAT202L",
      "courseTitle": "Probability and Statistics",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "E2",
      "slots": "E2+TE2",
      "venue": "AB1-802",
      "faculty": "THANGARAJ M",
      "facultyName": "THANGARAJ M",
      "courseName": "Probability and Statistics",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 30,
      "attendancePercentage": 90.0,
      "attendanceStatus": "Safe",
      "reportedPercentage": 90.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 30,
      "rawPercentage": 90.0,
      "percentage": 90.0,
      "displayPercentage": "90.0%",
      "safeToMiss": 6,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "FRI-14:55-C2",
    "day": "FRI",
    "dayName": "Friday",
    "slotName": "C2",
    "slot": "C2",
    "startTime": "14:55",
    "endTime": "15:45",
    "startTime12h": "02:55 PM",
    "endTime12h": "03:45 PM",
    "courseId": 8,
    "courseCode": "BECE355L",
    "courseName": "Advanced Cloud Computing",
    "courseTitle": "Advanced Cloud Computing",
    "subjectCode": "BECE355L",
    "subjectTitle": "Advanced Cloud Computing",
    "venue": "AB1-711",
    "room": "711",
    "building": "AB1",
    "block": "AB1",
    "faculty": "UPENDER P",
    "facultyName": "UPENDER P",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "8",
      "courseId": 8,
      "courseCode": "BECE355L",
      "courseTitle": "Advanced Cloud Computing",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "C2",
      "slots": "C2+TC2",
      "venue": "AB1-711",
      "faculty": "UPENDER P",
      "facultyName": "UPENDER P",
      "courseName": "Advanced Cloud Computing",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 28,
      "classesConducted": 30,
      "attendancePercentage": 93.3,
      "attendanceStatus": "Safe",
      "reportedPercentage": 94.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 28,
      "total": 30,
      "rawPercentage": 93.33333333333333,
      "percentage": 93.3,
      "displayPercentage": "93.3%",
      "safeToMiss": 7,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "FRI-15:50-TA2",
    "day": "FRI",
    "dayName": "Friday",
    "slotName": "TA2",
    "slot": "TA2",
    "startTime": "15:50",
    "endTime": "16:40",
    "startTime12h": "03:50 PM",
    "endTime12h": "04:40 PM",
    "courseId": 3,
    "courseCode": "BCSE308L",
    "courseName": "Computer Networks",
    "courseTitle": "Computer Networks",
    "subjectCode": "BCSE308L",
    "subjectTitle": "Computer Networks",
    "venue": "AB1-808",
    "room": "808",
    "building": "AB1",
    "block": "AB1",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "3",
      "courseId": 3,
      "courseCode": "BCSE308L",
      "courseTitle": "Computer Networks",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "A2",
      "slots": "A2+TA2",
      "venue": "AB1-808",
      "faculty": "JAYA VIGNESH T",
      "facultyName": "JAYA VIGNESH T",
      "courseName": "Computer Networks",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  },
  {
    "id": "FRI-16:45-TF2",
    "day": "FRI",
    "dayName": "Friday",
    "slotName": "TF2",
    "slot": "TF2",
    "startTime": "16:45",
    "endTime": "17:35",
    "startTime12h": "04:45 PM",
    "endTime12h": "05:35 PM",
    "courseId": 1,
    "courseCode": "BCSE302L",
    "courseName": "Database Systems",
    "courseTitle": "Database Systems",
    "subjectCode": "BCSE302L",
    "subjectTitle": "Database Systems",
    "venue": "AB1-811",
    "room": "811",
    "building": "AB1",
    "block": "AB1",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 3.0,
    "isLab": false,
    "classType": "Theory",
    "type": "Theory",
    "resolved": true,
    "attendance": {
      "id": "1",
      "courseId": 1,
      "courseCode": "BCSE302L",
      "courseTitle": "Database Systems",
      "courseType": "Theory Only",
      "type": "Theory",
      "slot": "F2",
      "slots": "F2+TF2",
      "venue": "AB1-811",
      "faculty": "RISHIKESHAN C A",
      "facultyName": "RISHIKESHAN C A",
      "courseName": "Database Systems",
      "credits": 3.0,
      "resolved": true,
      "classesAttended": 27,
      "classesConducted": 28,
      "attendancePercentage": 96.4,
      "attendanceStatus": "Safe",
      "reportedPercentage": 97.0,
      "odAttended": 0,
      "odHours": 0,
      "attended": 27,
      "total": 28,
      "rawPercentage": 96.42857142857143,
      "percentage": 96.4,
      "displayPercentage": "96.4%",
      "safeToMiss": 8,
      "needToAttend": 0,
      "isCritical": false,
      "status": "Safe",
      "hasValidData": true
    },
    "odHours": 0
  }
];

export const DEFAULT_ATTENDANCE: any[] = [
  {
    "id": "1",
    "courseCode": "BCSE302L",
    "courseTitle": "Database Systems",
    "courseName": "Database Systems",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "F2",
    "slots": "F2+TF2",
    "slotVenue": "AB1-811",
    "venue": "AB1-811",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 3.0,
    "attended": 27,
    "classesAttended": 27,
    "conducted": 28,
    "classesConducted": 28,
    "total": 28,
    "percentage": 96.4,
    "attendancePercentage": 96.4,
    "displayPercentage": "96.4%",
    "safeToMiss": 8,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "2",
    "courseCode": "BCSE302P",
    "courseTitle": "Database Systems Lab",
    "courseName": "Database Systems Lab",
    "courseType": "Lab Only",
    "type": "Lab",
    "slot": "L21",
    "slots": "L21+L22",
    "slotVenue": "AB4-411",
    "venue": "AB4-411",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "credits": 1.0,
    "attended": 20,
    "classesAttended": 20,
    "conducted": 20,
    "classesConducted": 20,
    "total": 20,
    "percentage": 100.0,
    "attendancePercentage": 100.0,
    "displayPercentage": "100.0%",
    "safeToMiss": 6,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Present"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "3",
    "courseCode": "BCSE308L",
    "courseTitle": "Computer Networks",
    "courseName": "Computer Networks",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "A2",
    "slots": "A2+TA2",
    "slotVenue": "AB1-808",
    "venue": "AB1-808",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 3.0,
    "attended": 27,
    "classesAttended": 27,
    "conducted": 28,
    "classesConducted": 28,
    "total": 28,
    "percentage": 96.4,
    "attendancePercentage": 96.4,
    "displayPercentage": "96.4%",
    "safeToMiss": 8,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "4",
    "courseCode": "BCSE308P",
    "courseTitle": "Computer Networks Lab",
    "courseName": "Computer Networks Lab",
    "courseType": "Lab Only",
    "type": "Lab",
    "slot": "L9",
    "slots": "L9+L10",
    "slotVenue": "AB4-407",
    "venue": "AB4-407",
    "faculty": "JAYA VIGNESH T",
    "facultyName": "JAYA VIGNESH T",
    "credits": 1.0,
    "attended": 20,
    "classesAttended": 20,
    "conducted": 20,
    "classesConducted": 20,
    "total": 20,
    "percentage": 100.0,
    "attendancePercentage": 100.0,
    "displayPercentage": "100.0%",
    "safeToMiss": 6,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Present"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "5",
    "courseCode": "BECE303L",
    "courseTitle": "VLSI System Design",
    "courseName": "VLSI System Design",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "B2",
    "slots": "B2+TB2",
    "slotVenue": "AB1-811",
    "venue": "AB1-811",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 3.0,
    "attended": 27,
    "classesAttended": 27,
    "conducted": 29,
    "classesConducted": 29,
    "total": 29,
    "percentage": 93.1,
    "attendancePercentage": 93.1,
    "displayPercentage": "93.1%",
    "safeToMiss": 7,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      },
      {
        "date": "14-Apr-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "6",
    "courseCode": "BECE303P",
    "courseTitle": "VLSI System Design Lab",
    "courseName": "VLSI System Design Lab",
    "courseType": "Lab Only",
    "type": "Lab",
    "slot": "L15",
    "slots": "L15+L16",
    "slotVenue": "AB3-312",
    "venue": "AB3-312",
    "faculty": "SARAVANA KUMAR R",
    "facultyName": "SARAVANA KUMAR R",
    "credits": 1.0,
    "attended": 20,
    "classesAttended": 20,
    "conducted": 20,
    "classesConducted": 20,
    "total": 20,
    "percentage": 100.0,
    "attendancePercentage": 100.0,
    "displayPercentage": "100.0%",
    "safeToMiss": 6,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Present"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "7",
    "courseCode": "BECE309L",
    "courseTitle": "Artificial Intelligence and Machine Learning",
    "courseName": "Artificial Intelligence and Machine Learning",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "G2",
    "slots": "G2+TG2",
    "slotVenue": "AB1-802",
    "venue": "AB1-802",
    "faculty": "PRAVEEN JARAUT",
    "facultyName": "PRAVEEN JARAUT",
    "credits": 3.0,
    "attended": 30,
    "classesAttended": 30,
    "conducted": 31,
    "classesConducted": 31,
    "total": 31,
    "percentage": 96.8,
    "attendancePercentage": 96.8,
    "displayPercentage": "96.8%",
    "safeToMiss": 9,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      },
      {
        "date": "14-Apr-2026",
        "status": "Present"
      },
      {
        "date": "16-Apr-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "8",
    "courseCode": "BECE355L",
    "courseTitle": "Advanced Cloud Computing",
    "courseName": "Advanced Cloud Computing",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "C2",
    "slots": "C2+TC2",
    "slotVenue": "AB1-711",
    "venue": "AB1-711",
    "faculty": "UPENDER P",
    "facultyName": "UPENDER P",
    "credits": 3.0,
    "attended": 28,
    "classesAttended": 28,
    "conducted": 30,
    "classesConducted": 30,
    "total": 30,
    "percentage": 93.3,
    "attendancePercentage": 93.3,
    "displayPercentage": "93.3%",
    "safeToMiss": 7,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      },
      {
        "date": "14-Apr-2026",
        "status": "Present"
      },
      {
        "date": "16-Apr-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "9",
    "courseCode": "BMAT202L",
    "courseTitle": "Probability and Statistics",
    "courseName": "Probability and Statistics",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "E2",
    "slots": "E2+TE2",
    "slotVenue": "AB1-802",
    "venue": "AB1-802",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 3.0,
    "attended": 27,
    "classesAttended": 27,
    "conducted": 30,
    "classesConducted": 30,
    "total": 30,
    "percentage": 90.0,
    "attendancePercentage": 90.0,
    "displayPercentage": "90.0%",
    "safeToMiss": 6,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "13-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      },
      {
        "date": "14-Apr-2026",
        "status": "Present"
      },
      {
        "date": "16-Apr-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "10",
    "courseCode": "BMAT202P",
    "courseTitle": "Probability and Statistics Lab",
    "courseName": "Probability and Statistics Lab",
    "courseType": "Lab Only",
    "type": "Lab",
    "slot": "L19",
    "slots": "L19+L20",
    "slotVenue": "AB1-606A",
    "venue": "AB1-606A",
    "faculty": "THANGARAJ M",
    "facultyName": "THANGARAJ M",
    "credits": 1.0,
    "attended": 20,
    "classesAttended": 20,
    "conducted": 20,
    "classesConducted": 20,
    "total": 20,
    "percentage": 100.0,
    "attendancePercentage": 100.0,
    "displayPercentage": "100.0%",
    "safeToMiss": 6,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Present"
      },
      {
        "date": "10-Jan-2026",
        "status": "Present"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      }
    ]
  },
  {
    "id": "12",
    "courseCode": "BSTS301P",
    "courseTitle": "Advanced Competitive Coding - I",
    "courseName": "Advanced Competitive Coding - I",
    "courseType": "Soft Skill",
    "type": "Theory",
    "slot": "D2",
    "slots": "D2+TD2",
    "slotVenue": "AB1-710",
    "venue": "AB1-710",
    "faculty": "ETHNUS (APT)",
    "facultyName": "ETHNUS (APT)",
    "credits": 1.5,
    "attended": 27,
    "classesAttended": 27,
    "conducted": 29,
    "classesConducted": 29,
    "total": 29,
    "percentage": 93.1,
    "attendancePercentage": 93.1,
    "displayPercentage": "93.1%",
    "safeToMiss": 7,
    "needToAttend": 0,
    "status": "Safe",
    "attendanceStatus": "Safe",
    "hasValidData": true,
    "viewLink": [
      {
        "date": "08-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "10-Jan-2026",
        "status": "Absent"
      },
      {
        "date": "13-Jan-2026",
        "status": "Present"
      },
      {
        "date": "15-Jan-2026",
        "status": "Present"
      },
      {
        "date": "20-Jan-2026",
        "status": "Present"
      },
      {
        "date": "22-Jan-2026",
        "status": "Present"
      },
      {
        "date": "27-Jan-2026",
        "status": "Present"
      },
      {
        "date": "29-Jan-2026",
        "status": "Present"
      },
      {
        "date": "03-Feb-2026",
        "status": "Present"
      },
      {
        "date": "05-Feb-2026",
        "status": "Present"
      },
      {
        "date": "10-Feb-2026",
        "status": "Present"
      },
      {
        "date": "12-Feb-2026",
        "status": "Present"
      },
      {
        "date": "17-Feb-2026",
        "status": "Present"
      },
      {
        "date": "19-Feb-2026",
        "status": "Present"
      },
      {
        "date": "24-Feb-2026",
        "status": "Present"
      },
      {
        "date": "26-Feb-2026",
        "status": "Present"
      },
      {
        "date": "03-Mar-2026",
        "status": "Present"
      },
      {
        "date": "05-Mar-2026",
        "status": "Present"
      },
      {
        "date": "10-Mar-2026",
        "status": "Present"
      },
      {
        "date": "12-Mar-2026",
        "status": "Present"
      },
      {
        "date": "17-Mar-2026",
        "status": "Present"
      },
      {
        "date": "19-Mar-2026",
        "status": "Present"
      },
      {
        "date": "24-Mar-2026",
        "status": "Present"
      },
      {
        "date": "26-Mar-2026",
        "status": "Present"
      },
      {
        "date": "31-Mar-2026",
        "status": "Present"
      },
      {
        "date": "02-Apr-2026",
        "status": "Present"
      },
      {
        "date": "07-Apr-2026",
        "status": "Present"
      },
      {
        "date": "09-Apr-2026",
        "status": "Present"
      },
      {
        "date": "14-Apr-2026",
        "status": "Present"
      }
    ]
  }
];

export const DEFAULT_MARKS: any[] = [
  {
    "id": "8",
    "courseId": 8,
    "courseCode": "BECE355L",
    "courseTitle": "Advanced Cloud Computing",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "C2",
    "faculty": "UPENDER P",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 46.0,
        "max": 50.0,
        "weightage": 13.8,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 13.8,
    "weightageGraded": 15.0,
    "weightageTotal": 15.0
  },
  {
    "id": "1",
    "courseId": 1,
    "courseCode": "BCSE302L",
    "courseTitle": "Database Systems",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "F2",
    "faculty": "RISHIKESHAN C A",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 34.0,
        "max": 50.0,
        "weightage": 10.2,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 10.2,
    "weightageGraded": 15.0,
    "weightageTotal": 15.0
  },
  {
    "id": "7",
    "courseId": 7,
    "courseCode": "BECE309L",
    "courseTitle": "Artificial Intelligence and Machine Learning",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "G2",
    "faculty": "PRAVEEN JARAUT",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 38.0,
        "max": 50.0,
        "weightage": 11.4,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 11.4,
    "weightageGraded": 15.0,
    "weightageTotal": 15.0
  },
  {
    "id": "9",
    "courseId": 9,
    "courseCode": "BMAT202L",
    "courseTitle": "Probability and Statistics",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "E2",
    "faculty": "THANGARAJ M",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 28.0,
        "max": 50.0,
        "weightage": 8.4,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 8.4,
    "weightageGraded": 15.0,
    "weightageTotal": 15.0
  },
  {
    "id": "12",
    "courseId": 12,
    "courseCode": "BSTS301P",
    "courseTitle": "Advanced Competitive Coding - I",
    "courseType": "Soft Skill",
    "type": "Theory",
    "slot": "D2",
    "faculty": "ETHNUS (APT)",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 27.0,
        "max": 30.0,
        "weightage": 13.5,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      },
      {
        "title": "Assessment - 1",
        "scored": 12.0,
        "max": 15.0,
        "weightage": 12.0,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 25.5,
    "weightageGraded": 30.0,
    "weightageTotal": 30.0
  },
  {
    "id": "3",
    "courseId": 3,
    "courseCode": "BCSE308L",
    "courseTitle": "Computer Networks",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "A2",
    "faculty": "JAYA VIGNESH T",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 32.5,
        "max": 50.0,
        "weightage": 9.75,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 9.75,
    "weightageGraded": 15.0,
    "weightageTotal": 15.0
  },
  {
    "id": "5",
    "courseId": 5,
    "courseCode": "BECE303L",
    "courseTitle": "VLSI System Design",
    "courseType": "Theory Only",
    "type": "Theory",
    "slot": "B2",
    "faculty": "SARAVANA KUMAR R",
    "resolved": true,
    "components": [
      {
        "title": "Continuous Assessment Test - I",
        "scored": 22.0,
        "max": 50.0,
        "weightage": 6.6,
        "maxWeightage": 15.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 6.6,
    "weightageGraded": 15.0,
    "weightageTotal": 15.0
  },
  {
    "id": "11",
    "courseId": 11,
    "courseCode": "BSSC101N",
    "courseTitle": "Essence of Traditional Knowledge",
    "courseType": "Online Course",
    "type": "Theory",
    "slot": "NIL",
    "faculty": "MAHARISHI R",
    "resolved": true,
    "components": [
      {
        "title": "Assessment - 3",
        "scored": 9.0,
        "max": 10.0,
        "weightage": 9.0,
        "maxWeightage": 10.0,
        "average": null,
        "status": "Present"
      },
      {
        "title": "Assessment - 2",
        "scored": 9.0,
        "max": 10.0,
        "weightage": 9.0,
        "maxWeightage": 10.0,
        "average": null,
        "status": "Present"
      },
      {
        "title": "Assessment - 1",
        "scored": 8.0,
        "max": 10.0,
        "weightage": 8.0,
        "maxWeightage": 10.0,
        "average": null,
        "status": "Present"
      }
    ],
    "weightageScored": 26.0,
    "weightageGraded": 30.0,
    "weightageTotal": 30.0
  }
];

export const DEFAULT_EXAMS: any = {
  "CAT 2": [
    {
      "slot": "A2",
      "date": "25-SEP-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB3-208",
      "seat_location": "R8C2",
      "seat_number": 16
    },
    {
      "slot": "B2",
      "date": "26-SEP-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB1-701",
      "seat_location": "R2C8",
      "seat_number": 58
    },
    {
      "slot": "C2",
      "date": "27-SEP-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB1-710",
      "seat_location": "R3C8",
      "seat_number": 60
    },
    {
      "slot": "D2",
      "date": "28-SEP-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB1-307",
      "seat_location": "R5C3",
      "seat_number": 25
    },
    {
      "slot": "E2",
      "date": "29-SEP-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB3-604",
      "seat_location": "R5C4",
      "seat_number": 28
    },
    {
      "slot": "F2",
      "date": "30-SEP-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB3-203",
      "seat_location": "R6C7",
      "seat_number": 65
    },
    {
      "slot": "G2",
      "date": "01-OCT-2026",
      "start_time": "09:30 AM",
      "end_time": "11:00 AM",
      "venue": "AB3-107",
      "seat_location": "R4C6",
      "seat_number": 44
    }
  ],
  "CAT 1": [
    {
      "slot": "A2",
      "date": "08-AUG-2026",
      "start_time": "12:00 PM",
      "end_time": "01:30 PM",
      "venue": "AB3-208",
      "seat_location": "R8C2",
      "seat_number": 16
    },
    {
      "slot": "B2",
      "date": "09-AUG-2026",
      "start_time": "12:00 PM",
      "end_time": "01:30 PM",
      "venue": "AB1-701",
      "seat_location": "R3C8",
      "seat_number": 60
    },
    {
      "slot": "C2",
      "date": "10-AUG-2026",
      "start_time": "02:00 PM",
      "end_time": "03:30 PM",
      "venue": "AB1-710",
      "seat_location": "R5C7",
      "seat_number": 63
    },
    {
      "slot": "D2",
      "date": "11-AUG-2026",
      "start_time": "02:00 PM",
      "end_time": "03:30 PM",
      "venue": "AB1-505A",
      "seat_location": "R5C3",
      "seat_number": 25
    },
    {
      "slot": "E2",
      "date": "12-AUG-2026",
      "start_time": "02:00 PM",
      "end_time": "03:30 PM",
      "venue": "AB3-605",
      "seat_location": "R5C8",
      "seat_number": 64
    },
    {
      "slot": "F2",
      "date": "13-AUG-2026",
      "start_time": "02:00 PM",
      "end_time": "03:30 PM",
      "venue": "AB3-503",
      "seat_location": "R2C8",
      "seat_number": 58
    },
    {
      "slot": "G2",
      "date": "14-AUG-2026",
      "start_time": "02:00 PM",
      "end_time": "03:30 PM",
      "venue": "AB3-308",
      "seat_location": "R6C4",
      "seat_number": 30
    }
  ]
};

export const DEFAULT_FACULTY: any[] = [
  {
    "name": "Dr. RAVI SANKAR A",
    "courses": [
      "DEAN"
    ],
    "venue": "AB1--7F--AB1/7th floor/Annexure/08",
    "cabin": "AB1--7F--AB1/7th floor/Annexure/08",
    "email": "deancc.sense@vit.ac.in",
    "phone": null,
    "designation": "DEAN",
    "isProctor": false
  },
  {
    "name": "Dr. VIJAYAKUMAR P",
    "courses": [
      "Head of the Department (HoD)"
    ],
    "venue": "AB1--5F--AB1/5th floor/Communication Lab/505",
    "cabin": "AB1--5F--AB1/5th floor/Communication Lab/505",
    "email": "hodcc.blc@vit.ac.in",
    "phone": null,
    "designation": "Head of the Department (HoD)",
    "isProctor": false
  },
  {
    "name": "ETHNUS (APT)",
    "courses": [
      "BSTS301P"
    ],
    "venue": "AB1-710",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "JAYA VIGNESH T",
    "courses": [
      "BCSE308L",
      "BCSE308P"
    ],
    "venue": "AB1-808",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "MAHARISHI R",
    "courses": [
      "BSSC101N"
    ],
    "venue": "NIL",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "PRAVEEN JARAUT",
    "courses": [
      "BECE309L"
    ],
    "venue": "AB1-802",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "RISHIKESHAN C A",
    "courses": [
      "BCSE302L",
      "BCSE302P"
    ],
    "venue": "AB1-811",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "SARAVANA KUMAR R",
    "courses": [
      "BECE303L",
      "BECE303P"
    ],
    "venue": "AB1-811",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "FACULTY PROCTOR",
    "courses": [
      "Student Proctor"
    ],
    "venue": "AB-1 101",
    "cabin": "AB-1 101",
    "email": "proctor@vit.ac.in",
    "phone": "0000000000",
    "designation": "Associate Professor",
    "isProctor": true
  },
  {
    "name": "THANGARAJ M",
    "courses": [
      "BMAT202L",
      "BMAT202P"
    ],
    "venue": "AB1-802",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  },
  {
    "name": "UPENDER P",
    "courses": [
      "BECE355L"
    ],
    "venue": "AB1-711",
    "cabin": null,
    "email": null,
    "phone": null,
    "designation": "Course Faculty",
    "isProctor": false
  }
];

export const DEFAULT_ASSIGNMENTS: any[] = [
  {
    "id": "lms-808-12345",
    "activityId": "12345",
    "title": "Digital Assignment 1",
    "academicYear": "2026",
    "semester": "Fall Semester 2026-27",
    "semesterId": "CH20262701",
    "courseCode": "BCSE302L",
    "courseTitle": "Database Systems",
    "subject": "Database Systems",
    "faculty": "RISHIKESHAN C A",
    "facultyName": "RISHIKESHAN C A",
    "professor": "RISHIKESHAN C A",
    "lmsProfessor": "RISHIKESHAN C A",
    "instructor": "RISHIKESHAN C A",
    "verified": true,
    "source": "LMS",
    "lmsCourseId": "808",
    "externalCourseId": "808",
    "platformName": "VIT LMS",
    "platformUrl": "https://lms.vit.ac.in/mod/assign/view.php?id=12345",
    "submissionUrl": "https://lms.vit.ac.in/mod/assign/view.php?id=12345",
    "dueDate": "2026-08-28",
    "dueTime": "23:59",
    "status": "Pending",
    "applicationStatus": "PENDING",
    "isDone": false,
    "isSubmitted": false,
    "priority": "Critical",
    "weightage": 10,
    "instructions": "Assigned on VIT LMS (BCSE302L - Database Systems - RISHIKESHAN C A) by RISHIKESHAN C A.",
    "matchedLmsCourse": "BCSE302L - Database Systems - RISHIKESHAN C A",
    "verifiedCourseMatchId": "match-lms-808",
    "subjectId": "BCSE302L"
  }
];
