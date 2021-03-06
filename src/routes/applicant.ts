import { Job } from "./../model/Job";
import { User } from "../model/profile/User";
import { Router } from "express";
import { auth } from "../middleware/auth";
import { Applicant, IApplicant } from "../model/profile/Applicant";
import { stringify } from "node:querystring";

const applicantRouter = Router();

/**
 * This request needs to pass a JSON object with all the user data.
 * TODO: Add applicant id to user schema
 */
applicantRouter.post("/", auth, async (req, res) => {
  try {
    const { _userId, ...applicant }:
      & Omit<
        IApplicant,
        "_id" | "slug" | "user" | "profileType" | "selectedJobs" | "matchedJobs"
      >
      & { _userId: string } = req.body;

    if (!applicant.firstName) {
      return res.status(400).json({
        msg: "Applicant name is missing",
      });
    }

    const existingApplicant = await Applicant.findOne({ user: _userId });
    if (existingApplicant) {
      return res
        .status(400)
        .json({
          msg: `Applicant with that user already exists`,
          applicant: existingApplicant,
        });
    }

    const newApplicant = new Applicant({
      ...applicant,
      slug: applicant.firstName.toLowerCase() + "-" +
        applicant.surname?.toLowerCase(),
      user: _userId,
    });
    const savedApplicant = await newApplicant.save();

    const user = await User.findByIdAndUpdate(req.body._userId, {
      applicantProfile: savedApplicant._id,
    }, { new: true });

    res.status(200).json({
      msg:
        `Applicant ${applicant.firstName} ${applicant.surname} was added to database`,
      applicant: savedApplicant,
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: "Internal server error: " + err.message });
  }
});

applicantRouter.get("/", auth, async (req, res) => {
  try {
    const applicant = await Applicant.findOne({ user: req.body._userId })
      .populate("matchedJobs");

    if (applicant) {
      res.status(200).json({
        msg: `Applicant ${applicant?.firstName} ${applicant
          ?.surname} successfully retrieved`,
        applicant,
      });
    }

    res.status(400).json({
      msg:
        `Applicant retrieval failed: no applicant from user ${req.body._userId} was registered in our database.`,
    });
  } catch (err) {
    res.status(500).json({ msg: "Internal server error: " + err.message });
  }
});

applicantRouter.get("/slug/:slug", async (req, res) => {
  try {
    const applicant = await Applicant.findOne({ slug: req.params.slug })
      .populate("matchedJobs");

    if (applicant) {
      res.status(200).json({
        msg: `Applicant ${applicant?.firstName} ${applicant
          ?.surname} successfully retrieved`,
        applicant,
      });
    }

    res.status(400).json({
      msg:
        `Applicant retrieval failed: no applicant with slug ${req.params.slug} was registered in our database.`,
    });
  } catch (err) {
    res.status(500).json({ msg: "Internal server error: " + err.message });
  }
});

applicantRouter.put("/", auth, async (req, res) => {
  try {
    const { _userId, ...applicant }:
      & Omit<
        IApplicant,
        "_id" | "slug" | "user" | "profileType" | "selectedJobs" | "matchedJobs"
      >
      & { _userId: string } = req.body;

    const previousApplicant = await Applicant.findOneAndUpdate({
      user: req.body._userId,
    }, applicant);

    if (previousApplicant) {
      res.status(200).json({
        msg: `Applicant ${applicant?.firstName} ${applicant
          ?.surname} successfully updated`,
        applicant,
      });
    }

    res.status(400).json({
      msg:
        `Applicant update failed: no applicant from user ${req.body._userId} was registered in our database.`,
    });
  } catch (err) {
    res.status(500).json({ msg: "Internal server error: " + err.message });
  }
});

applicantRouter.patch("/select-job", auth, async (req, res) => {
  try {
    const { id } = req.body; // The id of the job

    const job = await Job.findById(id);
    const selectedApplicants: string[] = job?.selectedApplicants as string[];

    const applicant = await Applicant.findOne({
      user: req.body._userId,
    }) as IApplicant;

    if (selectedApplicants.find((jobId: string) => jobId == id)) {
      await job?.update({
        $push: { matchedApplicants: applicant._id },
      });

      await applicant.update({
        $push: { matchedJobs: id },
      });

      res.status(200).json({
        msg: "It's a match!",
        isMatch: true,
      });
    } else {
      await applicant.update({
        $push: { selectedJobs: id },
      });

      res.status(200).json({
        msg: "Selected job added to list",
        isMatch: false,
      });
    }
  } catch (err) {
    res.status(500).json({ msg: "Internal server error: " + err.message });
  }
});

applicantRouter.delete("/", auth, async (req, res) => {
  try {
    const applicant = await Applicant.findOneAndDelete({
      user: req.body._userId,
    });

    if (!applicant) {
      res.status(400).json(
        {
          msg:
            `Applicant deletion failed: no applicant from user ${req.body._userId} was registered in our database.`,
        },
      );
    }

    res.status(200).json({
      msg: `Applicant ${applicant?.firstName} ${applicant
        ?.surname} was deleted from the database`,
      applicant,
    });
  } catch (err) {
    res.status(500).json({ msg: "Internal server error: " + err.message });
  }
});

export default applicantRouter;
